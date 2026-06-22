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

	function createDraft(body: unknown) {
		const draft = validateDraftBody(body);
		return repo.createDraft({
			id: randomUUID(),
			text: draft.text,
			cwd: draft.cwd,
			model: draft.model,
			runtimeMode: draft.runtimeMode,
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
		const providerSession = repo.getProviderSession(conversationId);
		if (!conversation || !providerSession?.provider_thread_id) {
			throw new Error("Conversation is not ready to resume");
		}
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
			await sidecarFetch("/runtime/thread/resume", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					threadId: providerSession.provider_thread_id,
				}),
			});
			await startTurn(
				{ ...turn, threadId: providerSession.provider_thread_id },
				message.text,
			);
			return repo.getConversation(conversationId);
		} catch (error) {
			failActiveTurn(turn, error);
			throw error;
		}
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
			repo.completeTurn({
				turnId: activeTurn.turnId,
				raw: event.params,
				now: now(),
				status: "completed",
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
		createDraft,
		updateDraft,
		promoteDraftAndSend,
		sendConversationMessage,
		respondApproval,
		renameConversation,
		archiveConversation,
		deleteConversation,
		subscribe,
		stop,
	};
}
