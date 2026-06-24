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
import { toCodexAdmittedSendInput } from "../conversations/codexAdmittedTransport";
import { createConversationEventStore } from "../conversations/conversationEventStore";
import { useConversationHistoryStore } from "../conversations/conversationHistoryStore";
import {
	applyConversationEventProjection,
	type ConversationProjectionState,
	createEmptyConversationProjection,
	projectConversationDetail,
	summarizeConversationEvent,
} from "../conversations/conversationProjection";
import { loadConversationDetail } from "../conversations/conversationTransport";
import { defaultAnswers } from "./pendingRequestDefaults";

export function useCodexSession(input: {
	model: string;
	runtimeMode: CodexRuntimeMode;
	selectedFolderPath?: string;
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
	const projectionStateRef = useRef<ConversationProjectionState>(
		createEmptyConversationProjection(),
	);
	const eventStoreRef = useRef(createConversationEventStore());
	const history = useConversationHistoryStore();

	useEffect(() => {
		return () => eventStoreRef.current.clear();
	}, []);

	async function persistDraft(draft: ComposerDraftPersistInput) {
		if (conversationId) {
			return;
		}
		const draftInput = {
			text: draft.payload.text,
			model: draft.model,
			runtimeMode: draft.runtimeMode,
			attachments: draft.payload.attachments,
			payload: {
				mode: draft.payload.mode,
				contextItems: draft.payload.contextItems,
				attachments: draft.payload.attachments,
				parts: draft.payload.parts,
				metrics: draft.payload.metrics,
			},
			...(input.selectedFolderPath
				? { cwd: input.selectedFolderPath }
				: {}),
		};
		if (draftId) {
			await window.experimentalDesktop.updateDraft(draftId, draftInput);
			return;
		}
		const persistedDraft =
			await window.experimentalDesktop.createDraft(draftInput);
		setDraftId(persistedDraft.id);
	}

	async function openConversation(id: string) {
		eventStoreRef.current.clear();
		const conversation = await loadConversationDetail(id);
		if (!conversation) {
			setStatus("Conversation not found");
			return false;
		}
		await openLoadedConversation(conversation);
		return true;
	}

	async function openLoadedConversation(conversation: ConversationDetail) {
		eventStoreRef.current.clear();
		hydrateConversation(conversation);
		await eventStoreRef.current.subscribe(
			conversation.id,
			handleSessionEvent,
		);
		return true;
	}

	async function createNewSession() {
		eventStoreRef.current.clear();
		setDraftId(undefined);
		setConversationId(undefined);
		setThreadId(undefined);
		setEventLog([]);
		applyProjectionState(createEmptyConversationProjection("Draft ready"));
	}

	async function sendMessage(payload: ComposerPayload) {
		// TODO(P0): legacy compatibility only. Remove once ComposerRegion owns admission.
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
		const codexInput = toCodexAdmittedSendInput(request);
		if (!codexInput.text.trim()) {
			setStatus("Message required");
			return false;
		}
		appendAdmissionWarnings(request);
		setIsSending(true);
		setIsTurnActive(true);
		try {
			if (conversationId) {
				setStatus("Sending...");
				const conversation =
					await window.experimentalDesktop.sendConversationMessage(
						conversationId,
						{
							text: codexInput.text,
							model: codexInput.model,
							runtimeMode: codexInput.runtimeMode,
							nativeInput: codexInput.nativeInput,
							payload: codexInput.payload,
						},
					);
				if (conversation) {
					hydrateConversation(conversation);
				}
			} else {
				setStatus("Starting conversation...");
				const conversation =
					await window.experimentalDesktop.promoteDraftAndSend({
						draftId,
						text: codexInput.text,
						model: codexInput.model,
						runtimeMode: codexInput.runtimeMode,
						nativeInput: codexInput.nativeInput,
						payload: codexInput.payload,
						...(input.selectedFolderPath
							? { cwd: input.selectedFolderPath }
							: {}),
					});
				if (conversation) {
					hydrateConversation(conversation);
					eventStoreRef.current.clear();
					await eventStoreRef.current.subscribe(
						conversation.id,
						handleSessionEvent,
					);
				}
			}
			await history.refreshConversations();
			setStatus("Running...");
			return true;
		} catch (error) {
			setIsTurnActive(false);
			setStatus(error instanceof Error ? error.message : String(error));
			return false;
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
			await window.experimentalDesktop.respondApproval(
				conversationId,
				requestId,
				{ answers: defaultAnswers(request.data.raw) },
			);
		} else {
			await window.experimentalDesktop.respondApproval(
				conversationId,
				requestId,
				response,
			);
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
		await window.experimentalDesktop.interruptConversation(conversationId);
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
		reportComposerAdmissionBlock,
		interruptConversation,
		respondToRequest,
	};
}
