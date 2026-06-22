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
	DraftRecord,
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
			this.touchConversation(input.conversationId, "active", input.now);
		});
		run();
	}

	listConversations() {
		const rows = this.db
			.prepare(
				`SELECT c.*, ps.provider_thread_id
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
				`SELECT c.*, ps.provider_thread_id
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
		turnId: string;
		ordinal: number;
		role: "user" | "assistant" | "system";
		status: "pending" | "streaming" | "completed" | "failed";
		now: string;
	}) {
		this.db
			.prepare(
				`INSERT INTO messages
				(id, conversation_id, turn_id, ordinal, role, status, created_at, updated_at)
				VALUES (@id, @conversationId, @turnId, @ordinal, @role, @status, @now, @now)`,
			)
			.run(input);
	}

	private insertPart(input: {
		id: string;
		conversationId: string;
		messageId: string;
		turnId: string;
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

	private listMessages(conversationId: string): ConversationMessage[] {
		const rows = this.db
			.prepare(
				`SELECT
					m.*,
					COALESCE(GROUP_CONCAT(CASE WHEN p.type = 'text' THEN COALESCE(p.text, '') END, ''), '') AS text
				FROM messages m
				LEFT JOIN message_parts p ON p.message_id = m.id
				WHERE m.conversation_id = ?
				GROUP BY m.id
				ORDER BY m.ordinal ASC`,
			)
			.all(conversationId) as MessageRow[];
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
};

type ProviderSessionRow = {
	id: string;
	conversation_id: string;
	provider_thread_id: string | null;
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
	ordinal: number;
	role: "user" | "assistant" | "system";
	status: ConversationMessage["status"];
	text: string;
	created_at: string;
	updated_at: string;
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
	};
}

function mapMessage(row: MessageRow): ConversationMessage {
	return {
		id: row.id,
		conversationId: row.conversation_id,
		turnId: row.turn_id ?? undefined,
		ordinal: row.ordinal,
		role: row.role,
		status: row.status,
		text: row.text,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
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
