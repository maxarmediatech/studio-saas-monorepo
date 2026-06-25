import { useEffect, useRef, useState } from "react";
import type {
	CodexRuntimeMode,
	ConversationDetail,
	ConversationEvent,
	RespondSessionRequestInput,
} from "../../preload/types";
import type { PendingRequest, TranscriptItem } from "../app/types";
import type { ComposerPayload } from "../components/composer/composerPayload";
import type { ComposerDraftPersistInput } from "../components/composer/core/composerDraftSync";
import type { AdmittedComposerRequest } from "../components/composer/core/composerProviderTypes";
import { admitComposerRequest } from "../components/composer/core/composerSendController";
import { conversationClient } from "./conversationClient";
import {
	type ConversationEventStore,
	createConversationEventStore,
} from "./conversationEventStore";
import { useConversationHistoryStore } from "./conversationHistoryStore";
import {
	applyConversationEventProjection,
	type ConversationProjectionState,
	createEmptyConversationProjection,
	projectConversationDetail,
	summarizeConversationEvent,
} from "./conversationProjection";
import { defaultAnswers } from "./pendingRequestDefaults";

export type ConversationSessionControllerDeps = {
	client?: typeof conversationClient;
	createEventStore?: () => ConversationEventStore;
	useHistoryStore?: typeof useConversationHistoryStore;
};

export function useConversationSessionController(input: {
	model: string;
	runtimeMode: CodexRuntimeMode;
	selectedFolderPath?: string;
	deps?: ConversationSessionControllerDeps;
}) {
	const [draftId, setDraftId] = useState<string>();
	const [conversationId, setConversationId] = useState<string>();
	const [threadId, setThreadId] = useState<string>();
	const [status, setStatus] = useState("No conversation");
	const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
	const [eventLog, setEventLog] = useState<string[]>([]);
	const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>(
		[],
	);
	const [isSending, setIsSending] = useState(false);
	const [isTurnActive, setIsTurnActive] = useState(false);
	const eventVersionRef = useRef(0);
	const reconciliationRef = useRef<{
		generation: number;
		timer?: ReturnType<typeof setTimeout>;
	}>({ generation: 0 });
	const projectionStateRef = useRef<ConversationProjectionState>(
		createEmptyConversationProjection(),
	);
	const client = input.deps?.client ?? conversationClient;
	const createEventStore =
		input.deps?.createEventStore ?? createConversationEventStore;
	const eventStoreRef = useRef(createEventStore());
	const useHistoryStore =
		input.deps?.useHistoryStore ?? useConversationHistoryStore;
	const history = useHistoryStore();

	useEffect(() => {
		return () => {
			eventStoreRef.current.clear();
			clearReconciliation();
		};
	}, []);

	async function persistDraft(draft: ComposerDraftPersistInput) {
		if (conversationId) {
			return;
		}
		const persistedDraft = await client.persistDraft({
			draftId,
			draft,
			cwd: input.selectedFolderPath,
		});
		if (!draftId) {
			setDraftId(persistedDraft.id);
		}
	}

	async function openConversation(id: string) {
		eventStoreRef.current.clear();
		clearReconciliation();
		const conversation = await client.loadConversationDetail(id);
		if (!conversation) {
			setStatus("Conversation not found");
			return false;
		}
		await openLoadedConversation(conversation);
		return true;
	}

	async function openLoadedConversation(conversation: ConversationDetail) {
		eventStoreRef.current.clear();
		clearReconciliation();
		hydrateConversation(conversation);
		await eventStoreRef.current.subscribe(
			conversation.id,
			handleSessionEvent,
		);
		return true;
	}

	async function createNewSession() {
		eventStoreRef.current.clear();
		clearReconciliation();
		setDraftId(undefined);
		setConversationId(undefined);
		setThreadId(undefined);
		setEventLog([]);
		applyProjectionState(createEmptyConversationProjection("Draft ready"));
	}

	async function sendMessage(payload: ComposerPayload) {
		const admission = admitComposerRequest({
			payload,
			model: inputModel(),
			runtimeMode: inputRuntimeMode(),
		});
		if (!admission.ok) {
			setStatus(admission.reason);
			return false;
		}
		return sendAdmittedRequest(admission.request);
	}

	function reportComposerAdmissionBlock(reason: string) {
		setStatus(reason);
	}

	async function sendAdmittedRequest(request: AdmittedComposerRequest) {
		if (!request.providerInput.prompt.trim()) {
			setStatus("Message required");
			return false;
		}
		appendAdmissionWarnings(request);
		setIsSending(true);
		setIsTurnActive(true);
		try {
			const eventsBeforeSend = eventVersionRef.current;
			if (conversationId) {
				setStatus("Sending...");
				const conversation = await client.sendAdmittedRequest({
					conversationId,
					request,
				});
				if (
					conversation &&
					eventVersionRef.current === eventsBeforeSend
				) {
					hydrateConversation(conversation);
				}
				await reconcileConversation(conversationId, {
					untilSettled: true,
				});
			} else {
				setStatus("Starting conversation...");
				const conversation = await client.sendAdmittedRequest({
					draftId,
					cwd: input.selectedFolderPath,
					request,
				});
				if (conversation) {
					hydrateConversation(conversation);
					eventStoreRef.current.clear();
					await eventStoreRef.current.subscribe(
						conversation.id,
						handleSessionEvent,
					);
					await reconcileConversation(conversation.id, {
						untilSettled: true,
					});
				}
			}
			await history.refreshConversations();
			if (projectionStateRef.current.isTurnActive) {
				setStatus("Running...");
			}
			return true;
		} catch (error) {
			setIsTurnActive(false);
			setStatus(error instanceof Error ? error.message : String(error));
			return false;
		} finally {
			setIsSending(false);
		}
	}

	async function enqueueAdmittedRequest(request: AdmittedComposerRequest) {
		if (!conversationId) {
			setStatus("Start a conversation before queueing follow-ups");
			return undefined;
		}
		appendAdmissionWarnings(request);
		try {
			const queued = await client.enqueueAdmittedRequest({
				conversationId,
				request,
			});
			setStatus("Queued");
			return queued;
		} catch (error) {
			setStatus(error instanceof Error ? error.message : String(error));
			return undefined;
		}
	}

	async function cancelQueuedRequest(queueItemId: string) {
		await client.cancelQueuedRequest({ queueItemId });
		setStatus("Removed from queue");
	}

	async function executeNextQueuedRequest() {
		if (!conversationId) {
			return { ok: false as const, executed: false as const };
		}
		setIsSending(true);
		setIsTurnActive(true);
		try {
			const result = await client.executeNextQueuedRequest({
				conversationId,
			});
			if (!didExecuteQueuedRequest(result)) {
				throw new Error("Queue execution did not start");
			}
			const conversation = readExecutedConversation(result);
			if (conversation) {
				hydrateConversation(conversation);
			}
			await reconcileConversation(conversationId, {
				untilSettled: true,
			});
			await history.refreshConversations();
			if (projectionStateRef.current.isTurnActive) {
				setStatus("Running...");
			}
			return result;
		} catch (error) {
			setIsTurnActive(false);
			setStatus(error instanceof Error ? error.message : String(error));
			return { ok: false as const, executed: false as const };
		} finally {
			setIsSending(false);
		}
	}

	async function respondToRequest(
		requestId: string,
		responseOrDecision:
			| RespondSessionRequestInput
			| "accept"
			| "acceptForSession"
			| "decline"
			| "cancel",
	) {
		if (!conversationId) {
			return;
		}
		const response =
			typeof responseOrDecision === "string"
				? ({
						decision: responseOrDecision,
					} satisfies RespondSessionRequestInput)
				: responseOrDecision;
		const request = pendingRequests.find(
			(request) => request.data.requestId === requestId,
		);
		if (
			request?.data.requestKind === "user-input" &&
			!("answers" in response) &&
			response.decision !== "cancel"
		) {
			await client.respondToApproval({
				conversationId,
				requestId,
				response: { answers: defaultAnswers(request.data.raw) },
			});
		} else {
			await client.respondToApproval({
				conversationId,
				requestId,
				response,
			});
		}
		const canceled =
			"decision" in response && response.decision === "cancel";
		patchProjectionState({
			pendingRequests: projectionStateRef.current.pendingRequests.filter(
				(request) => request.data.requestId !== requestId,
			),
			status: canceled ? "Canceled" : "Running...",
			isTurnActive: !canceled,
		});
	}

	async function interruptConversation() {
		if (!conversationId) {
			return;
		}
		await client.interrupt({ conversationId });
		setIsSending(false);
		patchProjectionState({
			pendingRequests: [],
			isTurnActive: false,
			status: "Interrupted",
		});
		await history.refreshConversations();
	}

	function hydrateConversation(conversation: ConversationDetail) {
		setConversationId(conversation.id);
		setThreadId(conversation.providerThreadId);
		applyProjectionState(projectConversationDetail(conversation));
	}

	function handleSessionEvent(event: ConversationEvent) {
		eventVersionRef.current += 1;
		appendEventLog(event);
		const result = applyConversationEventProjection(
			projectionStateRef.current,
			event,
		);
		applyProjectionState(result.state);
		if (result.shouldRefreshConversations) {
			void history.refreshConversations();
		}
	}

	async function reconcileConversation(
		id: string,
		options: { untilSettled?: boolean } = {},
	) {
		const generation = ++reconciliationRef.current.generation;
		const eventVersion = eventVersionRef.current;
		clearReconciliationTimer();
		const conversation = await client.loadConversationDetail(id);
		if (
			generation !== reconciliationRef.current.generation ||
			eventVersion !== eventVersionRef.current ||
			!conversation
		) {
			return;
		}
		hydrateConversation(conversation);
		if (options.untilSettled && isConversationRunning(conversation)) {
			reconciliationRef.current.timer = setTimeout(() => {
				void reconcileConversation(id, options);
			}, 750);
		}
	}

	function clearReconciliation() {
		reconciliationRef.current.generation += 1;
		clearReconciliationTimer();
	}

	function clearReconciliationTimer() {
		if (reconciliationRef.current.timer) {
			clearTimeout(reconciliationRef.current.timer);
			reconciliationRef.current.timer = undefined;
		}
	}

	function applyProjectionState(state: ConversationProjectionState) {
		projectionStateRef.current = state;
		setTranscript(state.transcript);
		setPendingRequests(state.pendingRequests);
		setIsTurnActive(state.isTurnActive);
		setStatus(state.status);
	}

	function patchProjectionState(patch: Partial<ConversationProjectionState>) {
		applyProjectionState({
			...projectionStateRef.current,
			...patch,
		});
	}

	function appendEventLog(
		event: Parameters<typeof summarizeConversationEvent>[0],
	) {
		setEventLog((events) =>
			[
				...events,
				`${new Date(event.time).toLocaleTimeString()} ${event.type} ${summarizeConversationEvent(event)}`,
			].slice(-80),
		);
	}

	function appendAdmissionWarnings(request: AdmittedComposerRequest) {
		const warnings = [
			...request.admission.warnings,
			...request.admission.capabilityWarnings,
		];
		if (warnings.length === 0) {
			return;
		}
		const timestamp = new Date().toLocaleTimeString();
		setEventLog((events) =>
			[
				...events,
				...warnings.map(
					(warning) => `${timestamp} admission.warning ${warning}`,
				),
			].slice(-80),
		);
	}

	function inputRuntimeMode() {
		return input.runtimeMode;
	}

	function inputModel() {
		return input.model.trim() || "gpt-5.4-mini";
	}

	return {
		sessionId: conversationId,
		conversationId,
		draftId,
		threadId,
		status,
		conversations: history.conversations,
		transcript,
		eventLog,
		pendingRequests,
		isSending,
		isTurnActive,
		isTurnRunning: isSending || isTurnActive || pendingRequests.length > 0,
		createNewSession,
		openConversation,
		openLoadedConversation,
		persistDraft,
		sendMessage,
		sendAdmittedRequest,
		enqueueAdmittedRequest,
		cancelQueuedRequest,
		executeNextQueuedRequest,
		reportComposerAdmissionBlock,
		interruptConversation,
		respondToRequest,
	};
}

function readExecutedConversation(
	value: unknown,
): ConversationDetail | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return undefined;
	}
	const record = value as Record<string, unknown>;
	const conversation = record.conversation;
	if (
		conversation &&
		typeof conversation === "object" &&
		!Array.isArray(conversation)
	) {
		return conversation as ConversationDetail;
	}
	return undefined;
}

function didExecuteQueuedRequest(value: unknown) {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}
	const result = value as Record<string, unknown>;
	return result.ok === true && result.executed === true;
}

function isConversationRunning(conversation: ConversationDetail) {
	return (
		conversation.status === "active" ||
		conversation.status === "waiting_approval"
	);
}
