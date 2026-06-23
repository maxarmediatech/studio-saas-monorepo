import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import type { SidecarManager, SidecarRuntime } from "../server";
import type {
	CodexRuntimeEvent,
	CodexRuntimeMode,
} from "../sidecar-codex-runtime";
import type { ConversationDatabase } from "../storage/database";
import {
	approvalStatusFromResponse,
	isFailedTurn,
	now,
	parseSseMessage,
	readDeltaText,
	readErrorMessage,
	readItemId,
	readRequestKind,
	readTurnError,
	readTurnId,
	validateDraftBody,
	validateObject,
	validateRequestResponse,
	validateSendBody,
} from "./controller-utils";
import { ConversationRepository } from "./repository";
import {
	buildSummaryRequest,
	chunkMessagesForCompaction,
	estimateTokens,
} from "./summarizer";
import type { ConversationEvent } from "./types";

type ActiveTurn = {
	conversationId: string;
	providerSessionId: string;
	turnId: string;
	assistantMessageId: string;
	cwd: string;
	model?: string;
	runtimeMode: CodexRuntimeMode;
};

type ActiveApproval = {
	conversationId: string;
	turnId?: string;
	approvalId: string;
};

const MIN_SUMMARY_SOURCE_MESSAGES = 4;
const MIN_COMPACTION_SOURCE_MESSAGES = 8;
const AUTO_COMPACT_TOKEN_THRESHOLD = 24_000;
const COMPACTION_KEEP_RECENT_TOKENS = 20_000;

export function createConversationController(input: {
	db: ConversationDatabase;
	sidecarManager: SidecarManager;
}) {
	const repo = new ConversationRepository(input.db);
	const subscribers = new Map<
		string,
		Set<(event: ConversationEvent) => void>
	>();
	const activeTurnsByProviderTurnId = new Map<string, ActiveTurn>();
	const pendingTurns = new Map<string, ActiveTurn>();
	const activeApprovals = new Map<string, ActiveApproval>();
	let runtimeStream: AbortController | undefined;
	let activeTurnId: string | undefined;

	repo.recoverInterruptedState(now());
	repo.expireStaleApprovals(now());

	function listConversations() {
		return repo.listConversations();
	}

	function getConversation(conversationId: string) {
		return repo.getConversation(conversationId);
	}

	function getConversationTree(conversationId: string) {
		return repo.getConversationTree(conversationId);
	}

	function createDraft(body: unknown) {
		const draft = validateDraftBody(body);
		return repo.createDraft({
			id: randomUUID(),
			text: draft.text,
			cwd: draft.cwd,
			model: draft.model,
			runtimeMode: draft.runtimeMode,
			attachments: draft.attachments,
			payload: draft.payload,
			now: now(),
		});
	}

	function updateDraft(draftId: string, body: unknown) {
		const draft = validateDraftBody(body);
		return repo.updateDraft({
			id: draftId,
			text: draft.text,
			cwd: draft.cwd,
			model: draft.model,
			runtimeMode: draft.runtimeMode,
			attachments: draft.attachments,
			payload: draft.payload,
			now: now(),
		});
	}

	async function promoteDraftAndSend(body: unknown) {
		const message = validateSendBody(body);
		const cwd = message.cwd ?? homedir();
		assertNoActiveTurn();
		const ids = {
			conversationId: randomUUID(),
			providerSessionId: randomUUID(),
			turnId: randomUUID(),
			userMessageId: randomUUID(),
			assistantMessageId: randomUUID(),
		};
		const promoted = repo.promoteDraft({
			draftId: message.draftId,
			text: message.text,
			cwd,
			model: message.model,
			runtimeMode: message.runtimeMode,
			payload: message.payload,
			ids,
			now: now(),
		});
		const activeTurn: ActiveTurn = {
			conversationId: promoted.conversationId,
			providerSessionId: promoted.providerSessionId,
			turnId: promoted.turnId,
			assistantMessageId: promoted.assistantMessageId,
			cwd: promoted.cwd,
			model: promoted.model,
			runtimeMode: promoted.runtimeMode,
		};
		activeTurnId = promoted.turnId;
		pendingTurns.set(promoted.turnId, activeTurn);
		persistAndBroadcast({
			conversationId: promoted.conversationId,
			providerSessionId: promoted.providerSessionId,
			turnId: promoted.turnId,
			type: "message.created",
			raw: { text: promoted.text },
			event: {
				id: randomUUID(),
				type: "message.created",
				time: now(),
				data: {
					text: promoted.text,
					messageId: promoted.userMessageId,
					turnId: promoted.turnId,
				},
			},
		});
		try {
			await ensureRuntimeEvents();
			const thread = (await sidecarFetch("/runtime/thread/start", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					cwd: promoted.cwd,
					model: promoted.model,
					runtimeMode: promoted.runtimeMode,
				}),
			})) as { threadId: string };
			repo.setProviderThread({
				providerSessionId: promoted.providerSessionId,
				threadId: thread.threadId,
				state: thread,
				now: now(),
			});
			await startTurn(
				{ ...activeTurn, threadId: thread.threadId },
				promoted.text,
			);
			return repo.getConversation(promoted.conversationId);
		} catch (error) {
			failActiveTurn(activeTurn, error);
			throw error;
		}
	}

	async function sendConversationMessage(
		conversationId: string,
		body: unknown,
	) {
		const message = validateSendBody(body);
		assertNoActiveTurn();
		const conversation = repo.getConversation(conversationId);
		let providerSession = repo.getProviderSession(conversationId);
		if (!conversation || !providerSession) {
			throw new Error("Conversation is not ready to continue");
		}
		await maybeAutoCompactConversation(conversationId, {
			model: message.model ?? conversation.model,
		});
		providerSession = repo.getProviderSession(conversationId);
		if (!providerSession) {
			throw new Error("Conversation provider session is missing");
		}
		const shouldResumeProviderThread =
			!!providerSession.provider_thread_id &&
			providerSession.provider_leaf_message_id ===
				conversation.activeLeafMessageId;
		const runtimeText = shouldResumeProviderThread
			? message.text
			: repo.buildReplayPrompt(conversationId, message.text);
		const userMessageId = randomUUID();
		const assistantMessageId = randomUUID();
		const turn: ActiveTurn = {
			conversationId,
			providerSessionId: providerSession.id,
			turnId: randomUUID(),
			assistantMessageId,
			cwd: conversation.cwd,
			model: message.model ?? conversation.model,
			runtimeMode: conversation.runtimeMode,
		};
		repo.createTurn({
			conversationId,
			providerSessionId: providerSession.id,
			turnId: turn.turnId,
			userMessageId,
			assistantMessageId,
			text: message.text,
			payload: message.payload,
			now: now(),
		});
		activeTurnId = turn.turnId;
		pendingTurns.set(turn.turnId, turn);
		persistAndBroadcast({
			conversationId,
			providerSessionId: providerSession.id,
			turnId: turn.turnId,
			type: "message.created",
			raw: { text: message.text },
			event: {
				id: randomUUID(),
				type: "message.created",
				time: now(),
				data: {
					text: message.text,
					messageId: userMessageId,
					turnId: turn.turnId,
				},
			},
		});
		try {
			await ensureRuntimeEvents();
			let threadId = providerSession.provider_thread_id ?? undefined;
			if (shouldResumeProviderThread && threadId) {
				await sidecarFetch("/runtime/thread/resume", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ threadId }),
				});
			} else {
				const thread = (await sidecarFetch("/runtime/thread/start", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						cwd: turn.cwd,
						model: turn.model,
						runtimeMode: turn.runtimeMode,
					}),
				})) as { threadId: string };
				threadId = thread.threadId;
				repo.setProviderThread({
					providerSessionId: providerSession.id,
					threadId,
					state: thread,
					now: now(),
				});
			}
			await startTurn({ ...turn, threadId }, runtimeText);
			return repo.getConversation(conversationId);
		} catch (error) {
			if (pendingTurns.has(turn.turnId) || activeTurnId === turn.turnId) {
				failActiveTurn(turn, error);
			}
			throw error;
		}
	}

	async function interruptConversation(conversationId: string) {
		const activeTurn = findActiveTurn(conversationId);
		if (!activeTurn) {
			return { ok: true as const };
		}
		const interruptedAt = now();
		const message = "Interrupted";
		await sidecarFetch("/runtime/stop", { method: "POST" }).catch(
			(error) => {
				console.warn("[conversations] failed to stop runtime", error);
			},
		);
		runtimeStream?.abort();
		runtimeStream = undefined;
		repo.interruptTurn({
			turnId: activeTurn.turnId,
			message,
			now: interruptedAt,
		});
		repo.expirePendingApprovalsForTurn({
			turnId: activeTurn.turnId,
			response: { decision: "cancel", reason: message },
			now: interruptedAt,
		});
		const event: ConversationEvent = {
			id: randomUUID(),
			type: "turn.interrupted",
			time: interruptedAt,
			data: {
				turnId: activeTurn.turnId,
				providerTurnId: activeTurn.providerTurnId,
				message,
			},
		};
		persistAndBroadcast({
			conversationId: activeTurn.conversationId,
			providerSessionId: activeTurn.providerSessionId,
			turnId: activeTurn.turnId,
			type: event.type,
			raw: event.data,
			event,
		});
		clearTurn(activeTurn.turnId, activeTurn.providerTurnId);
		return { ok: true as const };
	}

	async function respondApproval(
		conversationId: string,
		requestId: string,
		body: unknown,
	) {
		const response = validateRequestResponse(body);
		const approval = activeApprovals.get(requestId);
		if (!approval || approval.conversationId !== conversationId) {
			throw new Error("Pending approval is not live");
		}
		await sidecarFetch(
			`/runtime/requests/${encodeURIComponent(requestId)}/respond`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(response),
			},
		);
		activeApprovals.delete(requestId);
		const status = approvalStatusFromResponse(response);
		const event: ConversationEvent = {
			id: randomUUID(),
			type: "request.resolved",
			time: now(),
			data: {
				requestId,
				approvalId: approval.approvalId,
				response,
			},
		};
		repo.resolveApproval({
			providerRequestId: requestId,
			status,
			response,
			now: event.time,
		});
		repo.recordEvent({
			id: event.id,
			conversationId,
			turnId: approval.turnId,
			type: event.type,
			raw: response,
			now: event.time,
		});
		broadcast(conversationId, event);
		return { ok: true as const };
	}

	function renameConversation(id: string, body: unknown) {
		const value = validateObject(body, "Rename body must be an object");
		if (typeof value.title !== "string" || !value.title.trim()) {
			throw new Error("Title is required");
		}
		return repo.renameConversation(id, value.title, now());
	}

	function archiveConversation(id: string) {
		return repo.archiveConversation(id, now());
	}

	function deleteConversation(id: string) {
		repo.deleteConversation(id, now());
		return { ok: true as const };
	}

	function branchConversation(conversationId: string, body: unknown) {
		assertNoActiveTurn();
		const value = validateObject(body, "Branch body must be an object");
		if (typeof value.messageId !== "string" || !value.messageId.trim()) {
			throw new Error("Branch target message id is required");
		}
		const previousLeafMessageId =
			repo.getActiveLeafMessageId(conversationId);
		const conversation = repo.branchConversationToMessage({
			conversationId,
			messageId: value.messageId,
			now: now(),
		});
		if (
			previousLeafMessageId &&
			previousLeafMessageId !== value.messageId
		) {
			queueSummary({
				conversationId,
				messageId: value.messageId,
				type: "branch",
				abandonedLeafMessageId: previousLeafMessageId,
				checkpointMessageId: value.messageId,
				messages: repo.getBranchSummarySource({
					conversationId,
					fromMessageId: previousLeafMessageId,
					toMessageId: value.messageId,
				}),
				model: conversation?.model,
			});
		}
		return conversation;
	}

	function forkConversation(conversationId: string, body: unknown) {
		assertNoActiveTurn();
		const value = validateObject(body, "Fork body must be an object");
		if (typeof value.messageId !== "string" || !value.messageId.trim()) {
			throw new Error("Fork target message id is required");
		}
		const forked = repo.forkConversationFromMessage({
			sourceConversationId: conversationId,
			messageId: value.messageId,
			ids: {
				conversationId: randomUUID(),
				providerSessionId: randomUUID(),
			},
			now: now(),
		});
		if (forked.conversation.activeLeafMessageId) {
			queueSummary({
				conversationId: forked.conversation.id,
				messageId: forked.conversation.activeLeafMessageId,
				type: "fork",
				model: forked.conversation.model,
			});
		}
		return forked;
	}

	function subscribe(
		conversationId: string,
		listener: (event: ConversationEvent) => void,
	) {
		let listeners = subscribers.get(conversationId);
		if (!listeners) {
			listeners = new Set();
			subscribers.set(conversationId, listeners);
		}
		listeners.add(listener);
		return () => {
			listeners?.delete(listener);
			if (listeners?.size === 0) {
				subscribers.delete(conversationId);
			}
		};
	}

	function stop() {
		runtimeStream?.abort();
		runtimeStream = undefined;
		subscribers.clear();
		activeTurnsByProviderTurnId.clear();
		pendingTurns.clear();
		activeApprovals.clear();
		activeTurnId = undefined;
	}

	async function startTurn(
		input: ActiveTurn & { threadId: string },
		text: string,
	) {
		const turn = (await sidecarFetch("/runtime/turn/start", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				threadId: input.threadId,
				text,
				cwd: input.cwd,
				model: input.model,
				runtimeMode: input.runtimeMode,
			}),
		})) as { turnId?: string };
		if (turn.turnId) {
			activeTurnsByProviderTurnId.set(turn.turnId, input);
		}
		repo.setTurnRunning({
			turnId: input.turnId,
			providerTurnId: turn.turnId,
			now: now(),
		});
	}

	async function ensureRuntimeEvents() {
		if (runtimeStream) {
			return;
		}
		const runtime = await input.sidecarManager.ensure();
		const abort = new AbortController();
		runtimeStream = abort;
		void streamRuntimeEvents(runtime, abort.signal)
			.catch((error) => {
				if (!abort.signal.aborted) {
					console.warn(
						"[conversations] runtime event stream failed",
						error,
					);
				}
			})
			.finally(() => {
				if (runtimeStream === abort) {
					runtimeStream = undefined;
				}
				if (!abort.signal.aborted) {
					failRuntimeDisconnected();
				}
			});
	}

	async function sidecarFetch(path: string, init: RequestInit) {
		const runtime = await input.sidecarManager.ensure();
		return input.sidecarManager.fetch(runtime, path, init);
	}

	async function maybeAutoCompactConversation(
		conversationId: string,
		input: { model?: string },
	) {
		const activeLeafMessageId = repo.getActiveLeafMessageId(conversationId);
		if (!activeLeafMessageId) {
			return false;
		}
		const source = repo.getCompactionSource({
			conversationId,
			messageId: activeLeafMessageId,
			keepRecentTokens: COMPACTION_KEEP_RECENT_TOKENS,
		});
		const tokensBefore = estimateTokens(source.candidateMessages);
		if (
			tokensBefore < AUTO_COMPACT_TOKEN_THRESHOLD ||
			source.candidateMessages.length < MIN_COMPACTION_SOURCE_MESSAGES ||
			source.headMessages.length === 0 ||
			!source.tailStartMessageId ||
			!source.lastSummarizedMessageId
		) {
			return false;
		}
		try {
			const stored = await generateAndStoreSummary({
				conversationId,
				messageId: activeLeafMessageId,
				type: "compaction",
				model: input.model,
				messages: source.headMessages,
				previousSummary: source.previousSummary?.summary,
				checkpointMessageId: source.lastSummarizedMessageId,
				tailStartMessageId: source.tailStartMessageId,
				tokensBefore,
			});
			if (!stored) {
				return false;
			}
			repo.markProviderThreadStale(conversationId, stored.createdAt);
			const event: ConversationEvent = {
				id: randomUUID(),
				type: "session.compacted",
				time: stored.createdAt,
				data: {
					summaryId: stored.summaryId,
					messageId: activeLeafMessageId,
					reason: "auto",
					tokensBefore,
				},
			};
			repo.recordEvent({
				id: event.id,
				conversationId,
				type: event.type,
				raw: event.data,
				now: event.time,
			});
			broadcast(conversationId, event);
			return true;
		} catch (error) {
			console.warn(
				"[conversations] failed to auto-compact session",
				error,
			);
			return false;
		}
	}

	function queueSummary(input: {
		conversationId: string;
		messageId: string;
		type: "branch" | "fork";
		abandonedLeafMessageId?: string;
		checkpointMessageId?: string;
		messages?: ReturnType<typeof repo.getSummarySource>;
		model?: string;
	}) {
		const messages =
			input.messages ??
			repo.getSummarySource({
				conversationId: input.conversationId,
				messageId: input.messageId,
			});
		if (messages.length < MIN_SUMMARY_SOURCE_MESSAGES) {
			return;
		}
		void generateAndStoreSummary({
			...input,
			messages,
		}).catch((error) => {
			console.warn(
				`[conversations] failed to generate ${input.type} summary`,
				error,
			);
		});
	}

	async function generateAndStoreSummary(input: {
		conversationId: string;
		messageId: string;
		type: "branch" | "fork" | "compaction";
		abandonedLeafMessageId?: string;
		model?: string;
		messages: ReturnType<typeof repo.getSummarySource>;
		previousSummary?: string;
		checkpointMessageId?: string;
		tailStartMessageId?: string;
		tokensBefore?: number;
	}) {
		let summary = input.previousSummary;
		const chunks =
			input.type === "compaction"
				? chunkMessagesForCompaction(input.messages)
				: [input.messages];
		for (const chunk of chunks) {
			const response = (await sidecarFetch("/summaries/conversation", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(
					buildSummaryRequest({
						model: input.model,
						purpose: input.type,
						messages: chunk,
						previousSummary: summary,
					}),
				),
			})) as { summary?: string };
			if (!response.summary?.trim()) {
				return undefined;
			}
			summary = response.summary.trim();
		}
		if (!summary?.trim()) {
			return undefined;
		}
		const summaryId = randomUUID();
		const createdAt = now();
		repo.storeSummary({
			id: summaryId,
			conversationId: input.conversationId,
			type: input.type,
			summary: summary.trim(),
			abandonedLeafMessageId: input.abandonedLeafMessageId,
			checkpointMessageId:
				input.checkpointMessageId ??
				(input.type === "compaction" ? undefined : input.messageId),
			tailStartMessageId: input.tailStartMessageId,
			tokensBefore: input.tokensBefore ?? estimateTokens(input.messages),
			now: createdAt,
		});
		return { summaryId, createdAt };
	}

	async function streamRuntimeEvents(
		runtime: SidecarRuntime,
		signal: AbortSignal,
	) {
		const response = await fetch(new URL("/runtime/events", runtime.url), {
			headers: {
				authorization: `Basic ${Buffer.from(`${runtime.username}:${runtime.password}`).toString("base64")}`,
			},
			signal,
		});
		if (!response.ok || !response.body) {
			throw new Error(`Runtime event stream failed: ${response.status}`);
		}
		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let buffer = "";
		while (!signal.aborted) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}
			buffer += decoder.decode(value, { stream: true });
			const messages = buffer.split("\n\n");
			buffer = messages.pop() ?? "";
			for (const message of messages) {
				const payload = parseSseMessage(message);
				if (payload) {
					handleRuntimeEvent(payload);
				}
			}
		}
	}

	function handleRuntimeEvent(event: CodexRuntimeEvent) {
		if (event.kind === "request.timeout") {
			const approval = activeApprovals.get(event.requestId);
			if (!approval) {
				return;
			}
			activeApprovals.delete(event.requestId);
			repo.resolveApproval({
				providerRequestId: event.requestId,
				status: "expired",
				response: { error: "timeout" },
				now: now(),
			});
			const turn = approval.turnId
				? repo.failTurn({
						turnId: approval.turnId,
						error: `Codex request timed out waiting for response: ${event.method}`,
						raw: event.params,
						now: now(),
					})
				: undefined;
			if (turn) {
				broadcastFailure(
					approval.conversationId,
					approval.turnId,
					`Codex request timed out waiting for response: ${event.method}`,
					event.params,
				);
				clearTurn(approval.turnId);
			}
			return;
		}
		const providerTurnId = readTurnId(event.params);
		const activeTurn = resolveActiveTurn(providerTurnId);
		if (!activeTurn) {
			return;
		}
		if (event.kind === "request") {
			handleApprovalRequest(activeTurn, event, providerTurnId);
			return;
		}
		if (event.method === "item/agentMessage/delta") {
			handleAssistantDelta(activeTurn, event, providerTurnId);
			return;
		}
		if (event.method === "turn/completed") {
			handleTurnCompleted(activeTurn, event, providerTurnId);
			return;
		}
		if (event.method === "error") {
			repo.failTurn({
				turnId: activeTurn.turnId,
				error: readErrorMessage(event.params),
				raw: event.params,
				now: now(),
			});
			broadcastFailure(
				activeTurn.conversationId,
				activeTurn.turnId,
				readErrorMessage(event.params),
				event.params,
			);
			clearTurn(activeTurn.turnId, providerTurnId);
			return;
		}
		recordProviderContext(activeTurn, event);
		const persisted: ConversationEvent = {
			id: randomUUID(),
			type: "provider.raw",
			time: now(),
			data: { method: event.method, params: event.params },
		};
		persistAndBroadcast({
			conversationId: activeTurn.conversationId,
			providerSessionId: activeTurn.providerSessionId,
			turnId: activeTurn.turnId,
			type: persisted.type,
			raw: event.params,
			event: persisted,
		});
	}

	function recordProviderContext(
		activeTurn: ActiveTurn,
		event: Extract<CodexRuntimeEvent, { kind: "notification" }>,
	) {
		const context = providerContextFromEvent(event.method, event.params);
		if (!context) {
			return;
		}
		const providerItemId = readItemId(event.params) ?? context.itemId;
		repo.recordProviderContextPart({
			id: [
				activeTurn.assistantMessageId,
				"provider",
				safePartId(context.kind),
				safePartId(providerItemId ?? event.method),
			].join(":"),
			conversationId: activeTurn.conversationId,
			messageId: activeTurn.assistantMessageId,
			turnId: activeTurn.turnId,
			providerItemId,
			type: context.type,
			text: context.text,
			json: {
				method: event.method,
				params: event.params,
				kind: context.kind,
			},
			append: context.append,
			now: now(),
		});
	}

	function handleApprovalRequest(
		activeTurn: ActiveTurn,
		event: Extract<CodexRuntimeEvent, { kind: "request" }>,
		providerTurnId?: string,
	) {
		const approvalId = randomUUID();
		activeApprovals.set(event.requestId, {
			conversationId: activeTurn.conversationId,
			turnId: activeTurn.turnId,
			approvalId,
		});
		const time = now();
		repo.createApproval({
			id: approvalId,
			conversationId: activeTurn.conversationId,
			turnId: activeTurn.turnId,
			providerRequestId: event.requestId,
			providerItemId: readItemId(event.params),
			kind: readRequestKind(event.method),
			request: event.params,
			now: time,
			expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
		});
		const persisted: ConversationEvent = {
			id: randomUUID(),
			type: "request.pending",
			time,
			data: {
				requestId: event.requestId,
				approvalId,
				method: event.method,
				requestKind: readRequestKind(event.method),
				turnId: activeTurn.turnId,
				providerTurnId,
				itemId: readItemId(event.params),
				raw: event.params,
			},
		};
		repo.recordEvent({
			id: persisted.id,
			conversationId: activeTurn.conversationId,
			providerSessionId: activeTurn.providerSessionId,
			turnId: activeTurn.turnId,
			type: persisted.type,
			raw: event.params,
			now: time,
		});
		broadcast(activeTurn.conversationId, persisted);
	}

	function handleAssistantDelta(
		activeTurn: ActiveTurn,
		event: Extract<CodexRuntimeEvent, { kind: "notification" }>,
		providerTurnId?: string,
	) {
		const text = readDeltaText(event.params);
		repo.appendAssistantDelta({
			turnId: activeTurn.turnId,
			text,
			raw: event.params,
			now: now(),
		});
		const persisted: ConversationEvent = {
			id: randomUUID(),
			type: "assistant.delta",
			time: now(),
			data: {
				text,
				turnId: activeTurn.turnId,
				providerTurnId,
				messageId: activeTurn.assistantMessageId,
				raw: event.params,
			},
		};
		persistAndBroadcast({
			conversationId: activeTurn.conversationId,
			providerSessionId: activeTurn.providerSessionId,
			turnId: activeTurn.turnId,
			type: persisted.type,
			raw: event.params,
			event: persisted,
		});
	}

	function handleTurnCompleted(
		activeTurn: ActiveTurn,
		event: Extract<CodexRuntimeEvent, { kind: "notification" }>,
		providerTurnId?: string,
	) {
		if (isFailedTurn(event.params)) {
			const error = readTurnError(event.params);
			repo.failTurn({
				turnId: activeTurn.turnId,
				error,
				raw: event.params,
				now: now(),
			});
			broadcastFailure(
				activeTurn.conversationId,
				activeTurn.turnId,
				error,
				event.params,
			);
		} else {
			const completedAt = now();
			repo.completeTurn({
				turnId: activeTurn.turnId,
				raw: event.params,
				now: completedAt,
				status: "completed",
			});
			repo.setProviderLeaf({
				providerSessionId: activeTurn.providerSessionId,
				messageId: activeTurn.assistantMessageId,
				now: completedAt,
			});
			const persisted: ConversationEvent = {
				id: randomUUID(),
				type: "assistant.completed",
				time: now(),
				data: {
					turnId: activeTurn.turnId,
					providerTurnId,
					messageId: activeTurn.assistantMessageId,
					raw: event.params,
				},
			};
			persistAndBroadcast({
				conversationId: activeTurn.conversationId,
				providerSessionId: activeTurn.providerSessionId,
				turnId: activeTurn.turnId,
				type: persisted.type,
				raw: event.params,
				event: persisted,
			});
		}
		clearTurn(activeTurn.turnId, providerTurnId);
	}

	function persistAndBroadcast(input: {
		conversationId: string;
		providerSessionId?: string;
		turnId?: string;
		type: ConversationEvent["type"];
		raw: unknown;
		event: ConversationEvent;
	}) {
		repo.recordEvent({
			id: input.event.id,
			conversationId: input.conversationId,
			providerSessionId: input.providerSessionId,
			turnId: input.turnId,
			type: input.type,
			raw: input.raw,
			now: input.event.time,
		});
		broadcast(input.conversationId, input.event);
	}

	function broadcastFailure(
		conversationId: string,
		turnId: string | undefined,
		error: string,
		raw?: unknown,
	) {
		const event: ConversationEvent = {
			id: randomUUID(),
			type: "message.failed",
			time: now(),
			data: { error, turnId, raw },
		};
		persistAndBroadcast({
			conversationId,
			turnId,
			type: event.type,
			raw: raw ?? { error },
			event,
		});
	}

	function failActiveTurn(activeTurn: ActiveTurn, error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		const failedAt = now();
		repo.failTurn({
			turnId: activeTurn.turnId,
			error: message,
			raw: { error: message },
			now: failedAt,
		});
		repo.expirePendingApprovalsForTurn({
			turnId: activeTurn.turnId,
			response: { error: message },
			now: failedAt,
		});
		broadcastFailure(activeTurn.conversationId, activeTurn.turnId, message);
		clearTurn(activeTurn.turnId);
	}

	function failRuntimeDisconnected() {
		const liveTurns = new Map<string, ActiveTurn>();
		for (const turn of pendingTurns.values()) {
			liveTurns.set(turn.turnId, turn);
		}
		for (const turn of activeTurnsByProviderTurnId.values()) {
			liveTurns.set(turn.turnId, turn);
		}
		for (const turn of liveTurns.values()) {
			failActiveTurn(turn, "Codex runtime event stream disconnected");
		}
	}

	function resolveActiveTurn(providerTurnId?: string) {
		if (providerTurnId) {
			const mapped = activeTurnsByProviderTurnId.get(providerTurnId);
			if (mapped) {
				return mapped;
			}
			const pending = getSinglePendingTurn();
			if (pending) {
				activeTurnsByProviderTurnId.set(providerTurnId, pending);
				repo.setTurnRunning({
					turnId: pending.turnId,
					providerTurnId,
					now: now(),
				});
				return pending;
			}
		}
		return getSinglePendingTurn();
	}

	function getSinglePendingTurn() {
		return pendingTurns.size === 1
			? pendingTurns.values().next().value
			: undefined;
	}

	function clearTurn(turnId?: string, providerTurnId?: string) {
		if (turnId) {
			pendingTurns.delete(turnId);
			if (activeTurnId === turnId) {
				activeTurnId = undefined;
			}
		}
		if (providerTurnId) {
			activeTurnsByProviderTurnId.delete(providerTurnId);
		}
		for (const [
			mappedProviderTurnId,
			activeTurn,
		] of activeTurnsByProviderTurnId) {
			if (activeTurn.turnId === turnId) {
				activeTurnsByProviderTurnId.delete(mappedProviderTurnId);
			}
		}
		for (const [requestId, approval] of activeApprovals) {
			if (approval.turnId === turnId) {
				activeApprovals.delete(requestId);
			}
		}
	}

	function findActiveTurn(conversationId: string) {
		for (const turn of pendingTurns.values()) {
			if (turn.conversationId === conversationId) {
				return { ...turn, providerTurnId: undefined };
			}
		}
		for (const [providerTurnId, turn] of activeTurnsByProviderTurnId) {
			if (turn.conversationId === conversationId) {
				return { ...turn, providerTurnId };
			}
		}
		return undefined;
	}

	function broadcast(conversationId: string, event: ConversationEvent) {
		const listeners = subscribers.get(conversationId);
		if (!listeners) {
			return;
		}
		for (const listener of listeners) {
			listener(event);
		}
	}

	function assertNoActiveTurn() {
		if (activeTurnId) {
			throw new Error("Another turn is already running");
		}
	}

	return {
		listConversations,
		getConversation,
		getConversationTree,
		createDraft,
		updateDraft,
		promoteDraftAndSend,
		sendConversationMessage,
		interruptConversation,
		respondApproval,
		renameConversation,
		archiveConversation,
		deleteConversation,
		branchConversation,
		forkConversation,
		subscribe,
		stop,
	};
}

type ProviderContextPart = {
	type: "tool_call" | "tool_result" | "raw";
	kind: string;
	itemId?: string;
	text?: string;
	append?: boolean;
};

function providerContextFromEvent(
	method: string,
	params: unknown,
): ProviderContextPart | undefined {
	if (method === "item/started") {
		const item = readPayloadItem(params);
		const itemType = normalizeProviderItemType(item?.type);
		if (!item || !isContextItemType(itemType)) {
			return undefined;
		}
		return {
			type: "tool_call",
			kind: itemType,
			itemId: readString(item.id),
			text: readProviderItemDetail(item),
		};
	}
	if (method === "item/completed") {
		const item = readPayloadItem(params);
		const itemType = normalizeProviderItemType(item?.type);
		if (!item || !isContextItemType(itemType)) {
			return undefined;
		}
		return {
			type: "tool_result",
			kind: itemType,
			itemId: readString(item.id),
			text: readProviderItemDetail(item),
		};
	}
	if (method === "item/commandExecution/outputDelta") {
		return {
			type: "tool_result",
			kind: "command_output",
			itemId: readItemId(params),
			text: readDeltaText(params),
			append: true,
		};
	}
	if (method === "item/fileChange/outputDelta") {
		return {
			type: "tool_result",
			kind: "file_change_output",
			itemId: readItemId(params),
			text: readDeltaText(params),
			append: true,
		};
	}
	if (
		method === "item/reasoning/textDelta" ||
		method === "item/reasoning/summaryTextDelta" ||
		method === "item/plan/delta"
	) {
		return {
			type: "raw",
			kind: method.replaceAll("/", "_"),
			itemId: readItemId(params),
			text: readDeltaText(params),
			append: true,
		};
	}
	if (
		method === "turn/plan/updated" ||
		method === "turn/diff/updated" ||
		method === "thread/tokenUsage/updated" ||
		method === "thread/compacted"
	) {
		return {
			type: "raw",
			kind: method.replaceAll("/", "_"),
			text: summarizeProviderParams(params),
		};
	}
	return undefined;
}

function readPayloadItem(value: unknown) {
	if (!isRecord(value) || !isRecord(value.item)) {
		return undefined;
	}
	return value.item;
}

function normalizeProviderItemType(value: unknown) {
	return typeof value === "string"
		? value
				.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
				.replace(/[._/-]/g, " ")
				.replace(/\s+/g, " ")
				.trim()
				.toLowerCase()
		: "";
}

function isContextItemType(type: string) {
	return (
		type.includes("command") ||
		type.includes("file change") ||
		type.includes("mcp") ||
		type.includes("dynamic tool") ||
		type.includes("collab") ||
		type.includes("web search") ||
		type.includes("reasoning") ||
		type.includes("plan") ||
		type.includes("compact") ||
		type.includes("error")
	);
}

function readProviderItemDetail(item: Record<string, unknown>) {
	for (const key of [
		"command",
		"title",
		"summary",
		"text",
		"path",
		"prompt",
	]) {
		const value = readString(item[key]);
		if (value) {
			return value;
		}
	}
	return summarizeProviderParams(item);
}

function readString(value: unknown) {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function summarizeProviderParams(value: unknown) {
	if (typeof value === "string") {
		return value;
	}
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

function safePartId(value: string) {
	return value.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 96) || "item";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}
