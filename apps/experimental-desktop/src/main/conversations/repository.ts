import { randomUUID } from "node:crypto";
import type { CodexRuntimeMode } from "../sidecar-codex-runtime";
import type { ConversationDatabase } from "../storage/database";
import type {
	ApprovalKind,
	ApprovalStatus,
	ConversationDetail,
	ConversationEvent,
	ConversationMessage,
	ConversationStatus,
	ConversationSummary,
	ConversationTreeNode,
	DraftRecord,
	ForkedConversation,
	PendingApproval,
	TurnStatus,
} from "./types";

type JsonValue = unknown;

export type PromotedTurn = {
	conversationId: string;
	providerSessionId: string;
	turnId: string;
	userMessageId: string;
	assistantMessageId: string;
	cwd: string;
	model?: string;
	runtimeMode: CodexRuntimeMode;
	text: string;
};

export class ConversationRepository {
	constructor(private readonly db: ConversationDatabase) {}

	createDraft(input: {
		id: string;
		text?: string;
		cwd?: string;
		model?: string;
		runtimeMode: CodexRuntimeMode;
		now: string;
	}) {
		this.db
			.prepare(
				`INSERT INTO drafts
				(id, text, cwd, model, runtime_mode, created_at, updated_at)
				VALUES (@id, @text, @cwd, @model, @runtimeMode, @now, @now)`,
			)
			.run({
				...input,
				text: input.text ?? "",
				cwd: input.cwd ?? null,
				model: input.model ?? null,
			});
		return this.getDraft(input.id);
	}

	updateDraft(input: {
		id: string;
		text?: string;
		cwd?: string;
		model?: string;
		runtimeMode?: CodexRuntimeMode;
		now: string;
	}) {
		const existing = this.getDraft(input.id);
		if (!existing) {
			return this.createDraft({
				id: input.id,
				text: input.text,
				cwd: input.cwd,
				model: input.model,
				runtimeMode: input.runtimeMode ?? "read-only",
				now: input.now,
			});
		}
		this.db
			.prepare(
				`UPDATE drafts
				SET text = @text,
					cwd = @cwd,
					model = @model,
					runtime_mode = @runtimeMode,
					updated_at = @now
				WHERE id = @id`,
			)
			.run({
				id: input.id,
				text: input.text ?? existing.text,
				cwd: input.cwd ?? existing.cwd ?? null,
				model: input.model ?? existing.model ?? null,
				runtimeMode: input.runtimeMode ?? existing.runtimeMode,
				now: input.now,
			});
		return this.getDraft(input.id);
	}

	getDraft(id: string) {
		const row = this.db
			.prepare("SELECT * FROM drafts WHERE id = ?")
			.get(id);
		return row ? mapDraft(row as DraftRow) : undefined;
	}

	recoverInterruptedState(now: string) {
		const run = this.db.transaction(() => {
			this.db
				.prepare(
					`UPDATE approvals
					SET status = 'expired', resolved_at = @now
					WHERE status = 'pending'`,
				)
				.run({ now });
			this.db
				.prepare(
					`UPDATE turns
					SET status = 'failed',
						error_json = @error,
						completed_at = COALESCE(completed_at, @now),
						updated_at = @now
					WHERE status IN ('queued', 'running', 'waiting_approval')`,
				)
				.run({
					now,
					error: stringify({
						message: "Turn interrupted by app restart",
					}),
				});
			this.db
				.prepare(
					`UPDATE messages
					SET status = 'interrupted', updated_at = @now
					WHERE status IN ('pending', 'streaming')`,
				)
				.run({ now });
			this.db
				.prepare(
					`UPDATE conversations
					SET status = 'failed', updated_at = @now
					WHERE status IN ('active', 'waiting_approval')`,
				)
				.run({ now });
		});
		run();
	}

	promoteDraft(input: {
		draftId?: string;
		text: string;
		cwd: string;
		model?: string;
		runtimeMode: CodexRuntimeMode;
		ids: {
			conversationId: string;
			providerSessionId: string;
			turnId: string;
			userMessageId: string;
			assistantMessageId: string;
		};
		now: string;
	}) {
		const run = this.db.transaction(() => {
			const title = titleFromText(input.text);
			this.db
				.prepare(
					`INSERT INTO conversations
					(id, title, cwd, model, runtime_mode, status, created_at, updated_at, last_message_at)
					VALUES (@conversationId, @title, @cwd, @model, @runtimeMode, 'active', @now, @now, @now)`,
				)
				.run({
					...input.ids,
					title,
					cwd: input.cwd,
					model: input.model ?? null,
					runtimeMode: input.runtimeMode,
					now: input.now,
				});
			this.db
				.prepare(
					`INSERT INTO provider_sessions
					(id, conversation_id, provider, status, created_at, updated_at)
					VALUES (@providerSessionId, @conversationId, 'codex', 'starting', @now, @now)`,
				)
				.run({ ...input.ids, now: input.now });
			this.db
				.prepare(
					`INSERT INTO turns
					(id, conversation_id, provider_session_id, user_message_id, assistant_message_id, status, created_at, updated_at)
					VALUES (@turnId, @conversationId, @providerSessionId, @userMessageId, @assistantMessageId, 'queued', @now, @now)`,
				)
				.run({ ...input.ids, now: input.now });
			this.insertMessage({
				id: input.ids.userMessageId,
				conversationId: input.ids.conversationId,
				turnId: input.ids.turnId,
				parentMessageId: undefined,
				ordinal: 0,
				role: "user",
				status: "completed",
				now: input.now,
			});
			this.insertPart({
				id: `${input.ids.userMessageId}:text`,
				conversationId: input.ids.conversationId,
				messageId: input.ids.userMessageId,
				turnId: input.ids.turnId,
				ordinal: 0,
				type: "text",
				text: input.text,
				json: {},
				now: input.now,
			});
			this.insertMessage({
				id: input.ids.assistantMessageId,
				conversationId: input.ids.conversationId,
				turnId: input.ids.turnId,
				parentMessageId: input.ids.userMessageId,
				ordinal: 1,
				role: "assistant",
				status: "streaming",
				now: input.now,
			});
			this.insertPart({
				id: `${input.ids.assistantMessageId}:text`,
				conversationId: input.ids.conversationId,
				messageId: input.ids.assistantMessageId,
				turnId: input.ids.turnId,
				ordinal: 0,
				type: "text",
				text: "",
				json: {},
				now: input.now,
			});
			this.setActiveLeafMessage(
				input.ids.conversationId,
				input.ids.assistantMessageId,
				input.now,
			);
			if (input.draftId) {
				this.db
					.prepare(
						`UPDATE drafts
						SET promoted_conversation_id = @conversationId, updated_at = @now
						WHERE id = @draftId`,
					)
					.run({
						draftId: input.draftId,
						conversationId: input.ids.conversationId,
						now: input.now,
					});
			}
		});
		run();
		return {
			...input.ids,
			cwd: input.cwd,
			model: input.model,
			runtimeMode: input.runtimeMode,
			text: input.text,
		} satisfies PromotedTurn;
	}

	createTurn(input: {
		conversationId: string;
		providerSessionId: string;
		turnId: string;
		userMessageId: string;
		assistantMessageId: string;
		text: string;
		now: string;
	}) {
		const run = this.db.transaction(() => {
			const nextOrdinal = this.nextMessageOrdinal(input.conversationId);
			const parentMessageId = this.getActiveLeafMessageId(
				input.conversationId,
			);
			this.db
				.prepare(
					`INSERT INTO turns
					(id, conversation_id, provider_session_id, user_message_id, assistant_message_id, status, created_at, updated_at)
					VALUES (@turnId, @conversationId, @providerSessionId, @userMessageId, @assistantMessageId, 'queued', @now, @now)`,
				)
				.run(input);
			this.insertMessage({
				id: input.userMessageId,
				conversationId: input.conversationId,
				turnId: input.turnId,
				parentMessageId,
				ordinal: nextOrdinal,
				role: "user",
				status: "completed",
				now: input.now,
			});
			this.insertPart({
				id: `${input.userMessageId}:text`,
				conversationId: input.conversationId,
				messageId: input.userMessageId,
				turnId: input.turnId,
				ordinal: 0,
				type: "text",
				text: input.text,
				json: {},
				now: input.now,
			});
			this.insertMessage({
				id: input.assistantMessageId,
				conversationId: input.conversationId,
				turnId: input.turnId,
				parentMessageId: input.userMessageId,
				ordinal: nextOrdinal + 1,
				role: "assistant",
				status: "streaming",
				now: input.now,
			});
			this.insertPart({
				id: `${input.assistantMessageId}:text`,
				conversationId: input.conversationId,
				messageId: input.assistantMessageId,
				turnId: input.turnId,
				ordinal: 0,
				type: "text",
				text: "",
				json: {},
				now: input.now,
			});
			this.setActiveLeafMessage(
				input.conversationId,
				input.assistantMessageId,
				input.now,
			);
			this.touchConversation(input.conversationId, "active", input.now);
		});
		run();
	}

	listConversations() {
		const rows = this.db
			.prepare(
				`SELECT c.*, ps.provider_thread_id, ps.provider_leaf_message_id
				FROM conversations c
				LEFT JOIN provider_sessions ps ON ps.conversation_id = c.id
				WHERE c.status != 'deleted'
				ORDER BY c.updated_at DESC`,
			)
			.all() as ConversationRow[];
		return rows.map(mapConversation);
	}

	getConversation(id: string): ConversationDetail | undefined {
		const row = this.db
			.prepare(
				`SELECT c.*, ps.provider_thread_id, ps.provider_leaf_message_id
				FROM conversations c
				LEFT JOIN provider_sessions ps ON ps.conversation_id = c.id
				WHERE c.id = ? AND c.status != 'deleted'`,
			)
			.get(id) as ConversationRow | undefined;
		if (!row) {
			return undefined;
		}
		return {
			...mapConversation(row),
			messages: this.listMessages(id),
			pendingApprovals: this.listPendingApprovals(id),
		};
	}

	getConversationTree(conversationId: string): ConversationTreeNode[] {
		const rows = this.db
			.prepare(
				`WITH text_parts AS (
					SELECT
						p.message_id,
						GROUP_CONCAT(COALESCE(p.text, ''), '') AS text
					FROM message_parts p
					WHERE p.type = 'text'
					GROUP BY p.message_id
				)
				SELECT
					m.*,
					COALESCE(text_parts.text, '') AS text,
					(SELECT COUNT(*) FROM messages child WHERE child.parent_message_id = m.id) AS child_count,
					CASE WHEN m.id = c.active_leaf_message_id THEN 1 ELSE 0 END AS is_active_leaf
				FROM messages m
				JOIN conversations c ON c.id = m.conversation_id
				LEFT JOIN text_parts ON text_parts.message_id = m.id
				WHERE m.conversation_id = ?
				ORDER BY m.ordinal ASC`,
			)
			.all(conversationId) as TreeMessageRow[];
		return rows.map(mapTreeNode);
	}

	branchConversationToMessage(input: {
		conversationId: string;
		messageId: string;
		now: string;
	}) {
		const message = this.getMessage(input.messageId);
		if (!message || message.conversation_id !== input.conversationId) {
			throw new Error("Branch target message was not found");
		}
		this.setActiveLeafMessage(
			input.conversationId,
			input.messageId,
			input.now,
		);
		return this.getConversation(input.conversationId);
	}

	forkConversationFromMessage(input: {
		sourceConversationId: string;
		messageId: string;
		ids: { conversationId: string; providerSessionId: string };
		now: string;
	}): ForkedConversation {
		const source = this.getConversation(input.sourceConversationId);
		if (!source) {
			throw new Error("Source conversation was not found");
		}
		const path = this.listMessagePathTo(
			input.sourceConversationId,
			input.messageId,
		);
		if (path.length === 0) {
			throw new Error("Fork target message was not found");
		}
		const sourceProvider = this.getProviderSession(
			input.sourceConversationId,
		);
		const idMap = new Map<string, string>();
		for (const message of path) {
			idMap.set(
				message.id,
				randomIdFrom(input.ids.conversationId, message.id),
			);
		}
		const run = this.db.transaction(() => {
			const target = path[path.length - 1];
			this.db
				.prepare(
					`INSERT INTO conversations
					(id, title, cwd, model, runtime_mode, status, parent_conversation_id, branched_from_message_id, branched_from_turn_id, branch_origin_provider_thread_id, created_at, updated_at, last_message_at)
					VALUES (@conversationId, @title, @cwd, @model, @runtimeMode, 'idle', @parentConversationId, @branchedFromMessageId, @branchedFromTurnId, @branchOriginProviderThreadId, @now, @now, @now)`,
				)
				.run({
					conversationId: input.ids.conversationId,
					title: `${source.title} fork`,
					cwd: source.cwd,
					model: source.model ?? null,
					runtimeMode: source.runtimeMode,
					parentConversationId: source.id,
					branchedFromMessageId: input.messageId,
					branchedFromTurnId: target.turnId ?? null,
					branchOriginProviderThreadId:
						sourceProvider?.provider_thread_id ?? null,
					now: input.now,
				});
			this.db
				.prepare(
					`INSERT INTO provider_sessions
					(id, conversation_id, provider, status, provider_state_json, created_at, updated_at)
					VALUES (@providerSessionId, @conversationId, 'codex', 'idle', @state, @now, @now)`,
				)
				.run({
					providerSessionId: input.ids.providerSessionId,
					conversationId: input.ids.conversationId,
					state: stringify({
						forkedFromConversationId: source.id,
						forkedFromMessageId: input.messageId,
					}),
					now: input.now,
				});
			for (const [index, message] of path.entries()) {
				const copiedId = idMap.get(message.id);
				if (!copiedId) {
					continue;
				}
				this.insertMessage({
					id: copiedId,
					conversationId: input.ids.conversationId,
					parentMessageId: message.parentMessageId
						? idMap.get(message.parentMessageId)
						: undefined,
					ordinal: index,
					role: message.role,
					status: message.status,
					now: input.now,
				});
				this.insertPart({
					id: `${copiedId}:text`,
					conversationId: input.ids.conversationId,
					messageId: copiedId,
					ordinal: 0,
					type: "text",
					text: message.text,
					json: { copiedFromMessageId: message.id },
					now: input.now,
				});
			}
			const copiedLeafId = idMap.get(input.messageId);
			if (copiedLeafId) {
				this.setActiveLeafMessage(
					input.ids.conversationId,
					copiedLeafId,
					input.now,
				);
			}
		});
		run();
		const conversation = this.getConversation(input.ids.conversationId);
		if (!conversation) {
			throw new Error("Forked conversation was not created");
		}
		return { conversation, copiedMessageCount: path.length };
	}

	buildReplayPrompt(conversationId: string, userText: string) {
		const messages = this.listMessages(conversationId);
		if (messages.length === 0) {
			return userText;
		}
		const transcript = messages
			.map((message) => `${message.role.toUpperCase()}: ${message.text}`)
			.join("\n\n");
		return [
			"Continue from this branched local conversation transcript.",
			"Use it as context, but answer only the latest user message.",
			"",
			transcript,
			"",
			`USER: ${userText}`,
		].join("\n");
	}

	getProviderSession(conversationId: string) {
		return this.db
			.prepare(
				"SELECT * FROM provider_sessions WHERE conversation_id = ?",
			)
			.get(conversationId) as ProviderSessionRow | undefined;
	}

	getTurnByProviderTurnId(providerTurnId: string) {
		return this.db
			.prepare("SELECT * FROM turns WHERE provider_turn_id = ?")
			.get(providerTurnId) as TurnRow | undefined;
	}

	getTurn(id: string) {
		return this.db.prepare("SELECT * FROM turns WHERE id = ?").get(id) as
			| TurnRow
			| undefined;
	}

	setProviderThread(input: {
		providerSessionId: string;
		threadId: string;
		state: JsonValue;
		now: string;
	}) {
		this.db
			.prepare(
				`UPDATE provider_sessions
				SET provider_thread_id = @threadId,
					provider_state_json = @state,
					status = 'active',
					updated_at = @now
				WHERE id = @providerSessionId`,
			)
			.run({
				providerSessionId: input.providerSessionId,
				threadId: input.threadId,
				state: stringify(input.state),
				now: input.now,
			});
	}

	setTurnRunning(input: {
		turnId: string;
		providerTurnId?: string;
		now: string;
	}) {
		this.db
			.prepare(
				`UPDATE turns
				SET provider_turn_id = COALESCE(@providerTurnId, provider_turn_id),
					status = 'running',
					started_at = COALESCE(started_at, @now),
					updated_at = @now
				WHERE id = @turnId`,
			)
			.run({
				turnId: input.turnId,
				providerTurnId: input.providerTurnId ?? null,
				now: input.now,
			});
	}

	setProviderLeaf(input: {
		providerSessionId: string;
		messageId: string;
		now: string;
	}) {
		this.db
			.prepare(
				`UPDATE provider_sessions
				SET provider_leaf_message_id = @messageId,
					status = 'active',
					updated_at = @now
				WHERE id = @providerSessionId`,
			)
			.run(input);
	}

	recordEvent(input: {
		id: string;
		conversationId: string;
		providerSessionId?: string;
		turnId?: string;
		type: ConversationEvent["type"];
		raw: JsonValue;
		now: string;
	}) {
		this.db
			.prepare(
				`INSERT INTO events
				(id, conversation_id, provider_session_id, turn_id, type, raw_json, created_at)
				VALUES (@id, @conversationId, @providerSessionId, @turnId, @type, @raw, @now)`,
			)
			.run({
				...input,
				providerSessionId: input.providerSessionId ?? null,
				turnId: input.turnId ?? null,
				raw: stringify(input.raw),
			});
	}

	appendAssistantDelta(input: {
		turnId: string;
		text?: string;
		raw: JsonValue;
		now: string;
	}) {
		const turn = this.getTurn(input.turnId);
		if (!turn) {
			return undefined;
		}
		const partId = `${turn.assistant_message_id}:text`;
		this.db
			.prepare(
				`UPDATE message_parts
				SET text = COALESCE(text, '') || @text,
					json = @raw,
					updated_at = @now
				WHERE id = @partId`,
			)
			.run({
				partId,
				text: input.text ?? "",
				raw: stringify(input.raw),
				now: input.now,
			});
		this.db
			.prepare(
				"UPDATE messages SET status = 'streaming', updated_at = ? WHERE id = ?",
			)
			.run(input.now, turn.assistant_message_id);
		this.touchConversation(turn.conversation_id, "active", input.now);
		return turn;
	}

	completeTurn(input: {
		turnId: string;
		raw: JsonValue;
		now: string;
		status: "completed" | "failed";
		error?: string;
	}) {
		const turn = this.getTurn(input.turnId);
		if (!turn) {
			return undefined;
		}
		const turnStatus: TurnStatus =
			input.status === "completed" ? "completed" : "failed";
		const messageStatus =
			input.status === "completed" ? "completed" : "failed";
		this.db
			.prepare(
				`UPDATE turns
				SET status = @turnStatus,
					error_json = @error,
					completed_at = @now,
					updated_at = @now
				WHERE id = @turnId`,
			)
			.run({
				turnId: input.turnId,
				turnStatus,
				error: input.error ? stringify({ message: input.error }) : null,
				now: input.now,
			});
		this.db
			.prepare(
				"UPDATE messages SET status = ?, updated_at = ? WHERE id = ?",
			)
			.run(messageStatus, input.now, turn.assistant_message_id);
		this.touchConversation(
			turn.conversation_id,
			input.status === "completed" ? "idle" : "failed",
			input.now,
		);
		return turn;
	}

	failTurn(input: {
		turnId: string;
		error: string;
		raw?: JsonValue;
		now: string;
	}) {
		return this.completeTurn({
			turnId: input.turnId,
			raw: input.raw ?? {},
			now: input.now,
			status: "failed",
			error: input.error,
		});
	}

	createApproval(input: {
		id: string;
		conversationId: string;
		turnId?: string;
		providerRequestId: string;
		providerItemId?: string;
		kind: ApprovalKind;
		request: JsonValue;
		now: string;
		expiresAt: string;
	}) {
		this.db
			.prepare(
				`INSERT INTO approvals
				(id, conversation_id, turn_id, provider_request_id, provider_item_id, kind, status, request_json, created_at, expires_at)
				VALUES (@id, @conversationId, @turnId, @providerRequestId, @providerItemId, @kind, 'pending', @request, @now, @expiresAt)`,
			)
			.run({
				...input,
				turnId: input.turnId ?? null,
				providerItemId: input.providerItemId ?? null,
				request: stringify(input.request),
			});
		if (input.turnId) {
			this.db
				.prepare(
					"UPDATE turns SET status = 'waiting_approval', updated_at = ? WHERE id = ?",
				)
				.run(input.now, input.turnId);
		}
		this.touchConversation(
			input.conversationId,
			"waiting_approval",
			input.now,
		);
	}

	resolveApproval(input: {
		providerRequestId: string;
		status: ApprovalStatus;
		response: JsonValue;
		now: string;
	}) {
		this.db
			.prepare(
				`UPDATE approvals
				SET status = @status,
					response_json = @response,
					resolved_at = @now
				WHERE provider_request_id = @providerRequestId AND status = 'pending'`,
			)
			.run({
				...input,
				response: stringify(input.response),
			});
	}

	expireStaleApprovals(now: string) {
		this.db
			.prepare(
				`UPDATE approvals
				SET status = 'expired', resolved_at = @now
				WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at <= @now`,
			)
			.run({ now });
	}

	expirePendingApprovalsForTurn(input: {
		turnId: string;
		response: JsonValue;
		now: string;
	}) {
		this.db
			.prepare(
				`UPDATE approvals
				SET status = 'expired',
					response_json = @response,
					resolved_at = @now
				WHERE turn_id = @turnId AND status = 'pending'`,
			)
			.run({
				turnId: input.turnId,
				response: stringify(input.response),
				now: input.now,
			});
	}

	renameConversation(id: string, title: string, now: string) {
		this.db
			.prepare(
				"UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
			)
			.run(title.trim(), now, id);
		return this.getConversation(id);
	}

	archiveConversation(id: string, now: string) {
		this.db
			.prepare(
				`UPDATE conversations
				SET status = 'archived', archived_at = @now, updated_at = @now
				WHERE id = @id`,
			)
			.run({ id, now });
		return this.getConversation(id);
	}

	deleteConversation(id: string, now: string) {
		this.db
			.prepare(
				`UPDATE conversations
				SET status = 'deleted', deleted_at = @now, updated_at = @now
				WHERE id = @id`,
			)
			.run({ id, now });
	}

	private insertMessage(input: {
		id: string;
		conversationId: string;
		turnId?: string;
		parentMessageId?: string;
		ordinal: number;
		role: "user" | "assistant" | "system";
		status:
			| "pending"
			| "streaming"
			| "completed"
			| "failed"
			| "interrupted";
		now: string;
	}) {
		this.db
			.prepare(
				`INSERT INTO messages
				(id, conversation_id, turn_id, parent_message_id, ordinal, role, status, created_at, updated_at)
				VALUES (@id, @conversationId, @turnId, @parentMessageId, @ordinal, @role, @status, @now, @now)`,
			)
			.run({
				...input,
				turnId: input.turnId ?? null,
				parentMessageId: input.parentMessageId ?? null,
			});
	}

	private insertPart(input: {
		id: string;
		conversationId: string;
		messageId: string;
		turnId?: string;
		ordinal: number;
		type: "text" | "tool_call" | "tool_result" | "approval" | "raw";
		text?: string;
		json: JsonValue;
		now: string;
	}) {
		this.db
			.prepare(
				`INSERT INTO message_parts
				(id, conversation_id, message_id, turn_id, ordinal, type, text, json, created_at, updated_at)
				VALUES (@id, @conversationId, @messageId, @turnId, @ordinal, @type, @text, @json, @now, @now)`,
			)
			.run({
				...input,
				turnId: input.turnId ?? null,
				text: input.text ?? null,
				json: stringify(input.json),
			});
	}

	private nextMessageOrdinal(conversationId: string) {
		const row = this.db
			.prepare(
				"SELECT COALESCE(MAX(ordinal), -1) + 1 AS ordinal FROM messages WHERE conversation_id = ?",
			)
			.get(conversationId) as { ordinal: number };
		return row.ordinal;
	}

	private getActiveLeafMessageId(conversationId: string) {
		const row = this.db
			.prepare(
				"SELECT active_leaf_message_id FROM conversations WHERE id = ?",
			)
			.get(conversationId) as
			| { active_leaf_message_id: string | null }
			| undefined;
		return row?.active_leaf_message_id ?? undefined;
	}

	private setActiveLeafMessage(
		conversationId: string,
		messageId: string,
		now: string,
	) {
		this.db
			.prepare(
				`UPDATE conversations
				SET active_leaf_message_id = @messageId,
					updated_at = @now
				WHERE id = @conversationId`,
			)
			.run({ conversationId, messageId, now });
	}

	private getMessage(messageId: string) {
		return this.db
			.prepare("SELECT * FROM messages WHERE id = ?")
			.get(messageId) as MessageRow | undefined;
	}

	private listMessagePathTo(
		conversationId: string,
		messageId: string,
	): ConversationMessage[] {
		const rows = this.db
			.prepare(
				`WITH RECURSIVE message_path AS (
					SELECT m.*, 0 AS depth
					FROM messages m
					WHERE m.id = @messageId AND m.conversation_id = @conversationId
					UNION ALL
					SELECT parent.*, message_path.depth + 1 AS depth
					FROM messages parent
					JOIN message_path ON message_path.parent_message_id = parent.id
				), text_parts AS (
					SELECT
						p.message_id,
						GROUP_CONCAT(COALESCE(p.text, ''), '') AS text
					FROM message_parts p
					WHERE p.type = 'text'
					GROUP BY p.message_id
				)
				SELECT message_path.*, COALESCE(text_parts.text, '') AS text
				FROM message_path
				LEFT JOIN text_parts ON text_parts.message_id = message_path.id
				ORDER BY message_path.depth DESC`,
			)
			.all({ conversationId, messageId }) as MessageRow[];
		return rows.map(mapMessage);
	}

	private listMessages(conversationId: string): ConversationMessage[] {
		const rows = this.db
			.prepare(
				`WITH RECURSIVE active_path AS (
					SELECT m.*, 0 AS depth
					FROM messages m
					WHERE m.id = COALESCE(
						(SELECT active_leaf_message_id FROM conversations WHERE id = @conversationId),
						(SELECT id FROM messages WHERE conversation_id = @conversationId ORDER BY ordinal DESC LIMIT 1)
					)
					UNION ALL
					SELECT parent.*, active_path.depth + 1 AS depth
					FROM messages parent
					JOIN active_path ON active_path.parent_message_id = parent.id
				), text_parts AS (
					SELECT
						p.message_id,
						GROUP_CONCAT(COALESCE(p.text, ''), '') AS text
					FROM message_parts p
					WHERE p.type = 'text'
					GROUP BY p.message_id
				)
				SELECT active_path.*, COALESCE(text_parts.text, '') AS text
				FROM active_path
				LEFT JOIN text_parts ON text_parts.message_id = active_path.id
				ORDER BY active_path.ordinal ASC`,
			)
			.all({ conversationId }) as MessageRow[];
		return rows.map(mapMessage);
	}

	private listPendingApprovals(conversationId: string): PendingApproval[] {
		const rows = this.db
			.prepare(
				`SELECT * FROM approvals
				WHERE conversation_id = ? AND status = 'pending'
				ORDER BY created_at ASC`,
			)
			.all(conversationId) as ApprovalRow[];
		return rows.map(mapApproval);
	}

	private touchConversation(
		conversationId: string,
		status: ConversationStatus,
		now: string,
	) {
		this.db
			.prepare(
				`UPDATE conversations
				SET status = @status,
					updated_at = @now,
					last_message_at = @now
				WHERE id = @conversationId`,
			)
			.run({ conversationId, status, now });
	}
}

type DraftRow = {
	id: string;
	text: string;
	cwd: string | null;
	model: string | null;
	runtime_mode: CodexRuntimeMode;
	created_at: string;
	updated_at: string;
	promoted_conversation_id: string | null;
};

type ConversationRow = {
	id: string;
	title: string;
	cwd: string;
	model: string | null;
	runtime_mode: CodexRuntimeMode;
	status: ConversationStatus;
	created_at: string;
	updated_at: string;
	last_message_at: string | null;
	provider_thread_id: string | null;
	provider_leaf_message_id: string | null;
	parent_conversation_id: string | null;
	branched_from_message_id: string | null;
	branched_from_turn_id: string | null;
	branch_origin_provider_thread_id: string | null;
	active_leaf_message_id: string | null;
};

type ProviderSessionRow = {
	id: string;
	conversation_id: string;
	provider_thread_id: string | null;
	provider_leaf_message_id: string | null;
};

type TurnRow = {
	id: string;
	conversation_id: string;
	provider_session_id: string;
	provider_turn_id: string | null;
	user_message_id: string;
	assistant_message_id: string;
};

type MessageRow = {
	id: string;
	conversation_id: string;
	turn_id: string | null;
	parent_message_id: string | null;
	ordinal: number;
	role: "user" | "assistant" | "system";
	status: ConversationMessage["status"];
	text: string;
	created_at: string;
	updated_at: string;
};

type TreeMessageRow = MessageRow & {
	child_count: number;
	is_active_leaf: 0 | 1;
};

type ApprovalRow = {
	id: string;
	conversation_id: string;
	turn_id: string | null;
	provider_request_id: string;
	provider_item_id: string | null;
	kind: ApprovalKind;
	status: ApprovalStatus;
	request_json: string;
	created_at: string;
	expires_at: string | null;
};

function mapDraft(row: DraftRow): DraftRecord {
	return {
		id: row.id,
		text: row.text,
		cwd: row.cwd ?? undefined,
		model: row.model ?? undefined,
		runtimeMode: row.runtime_mode,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		promotedConversationId: row.promoted_conversation_id ?? undefined,
	};
}

function mapConversation(row: ConversationRow): ConversationSummary {
	return {
		id: row.id,
		title: row.title,
		cwd: row.cwd,
		model: row.model ?? undefined,
		runtimeMode: row.runtime_mode,
		status: row.status,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		lastMessageAt: row.last_message_at ?? undefined,
		providerThreadId: row.provider_thread_id ?? undefined,
		providerLeafMessageId: row.provider_leaf_message_id ?? undefined,
		parentConversationId: row.parent_conversation_id ?? undefined,
		branchedFromMessageId: row.branched_from_message_id ?? undefined,
		branchedFromTurnId: row.branched_from_turn_id ?? undefined,
		branchOriginProviderThreadId:
			row.branch_origin_provider_thread_id ?? undefined,
		activeLeafMessageId: row.active_leaf_message_id ?? undefined,
	};
}

function mapMessage(row: MessageRow): ConversationMessage {
	return {
		id: row.id,
		conversationId: row.conversation_id,
		turnId: row.turn_id ?? undefined,
		parentMessageId: row.parent_message_id ?? undefined,
		ordinal: row.ordinal,
		role: row.role,
		status: row.status,
		text: row.text,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function mapTreeNode(row: TreeMessageRow): ConversationTreeNode {
	return {
		...mapMessage(row),
		childCount: row.child_count,
		isActiveLeaf: row.is_active_leaf === 1,
	};
}

function mapApproval(row: ApprovalRow): PendingApproval {
	return {
		id: row.id,
		conversationId: row.conversation_id,
		turnId: row.turn_id ?? undefined,
		providerRequestId: row.provider_request_id,
		providerItemId: row.provider_item_id ?? undefined,
		kind: row.kind,
		status: row.status,
		request: parseJson(row.request_json),
		createdAt: row.created_at,
		expiresAt: row.expires_at ?? undefined,
	};
}

function stringify(value: JsonValue) {
	return JSON.stringify(value ?? {});
}

function parseJson(value: string) {
	try {
		return JSON.parse(value) as unknown;
	} catch {
		return null;
	}
}

function titleFromText(text: string) {
	const title = text.replace(/\s+/g, " ").trim();
	if (!title) {
		return "Untitled conversation";
	}
	return title.length > 72 ? `${title.slice(0, 69)}...` : title;
}

function randomIdFrom(_conversationId: string, _sourceMessageId: string) {
	return randomUUID();
}
