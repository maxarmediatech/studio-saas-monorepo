import { useEffect, useRef, useState } from "react";
import type {
	CodexRuntimeMode,
	ConversationDetail,
	ConversationEvent,
	ConversationSummary,
	SessionEvent,
} from "../../preload/types";
import type { PendingRequest, TranscriptItem } from "../app/types";

const model = "gpt-5.4-mini";

export function useCodexSession(input: {
	runtimeMode: CodexRuntimeMode;
	selectedFolderPath?: string;
}) {
	const [draftId, setDraftId] = useState<string>();
	const [conversationId, setConversationId] = useState<string>();
	const [threadId, setThreadId] = useState<string>();
	const [status, setStatus] = useState("No conversation");
	const [conversations, setConversations] = useState<ConversationSummary[]>(
		[],
	);
	const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
	const [eventLog, setEventLog] = useState<string[]>([]);
	const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>(
		[],
	);
	const [isSending, setIsSending] = useState(false);
	const [isTurnActive, setIsTurnActive] = useState(false);
	const unsubscribeRef = useRef<(() => void) | undefined>(undefined);
	const seenEventsRef = useRef(new Set<string>());

	useEffect(() => {
		void refreshConversations();
		return () => unsubscribeRef.current?.();
	}, []);

	async function refreshConversations() {
		setConversations(await window.experimentalDesktop.listConversations());
	}

	async function persistDraft(text: string) {
		if (conversationId) {
			return;
		}
		const draftInput = {
			text,
			model,
			runtimeMode: inputRuntimeMode(),
			...(input.selectedFolderPath
				? { cwd: input.selectedFolderPath }
				: {}),
		};
		if (draftId) {
			await window.experimentalDesktop.updateDraft(draftId, draftInput);
			return;
		}
		const draft = await window.experimentalDesktop.createDraft(draftInput);
		setDraftId(draft.id);
	}

	async function openConversation(id: string) {
		unsubscribeRef.current?.();
		seenEventsRef.current.clear();
		const conversation =
			await window.experimentalDesktop.getConversation(id);
		if (!conversation) {
			setStatus("Conversation not found");
			return;
		}
		hydrateConversation(conversation);
		unsubscribeRef.current =
			await window.experimentalDesktop.subscribeConversationEvents(
				conversation.id,
				handleSessionEvent,
			);
	}

	async function createNewSession() {
		unsubscribeRef.current?.();
		seenEventsRef.current.clear();
		setDraftId(undefined);
		setConversationId(undefined);
		setThreadId(undefined);
		setTranscript([]);
		setEventLog([]);
		setPendingRequests([]);
		setIsTurnActive(false);
		setStatus("Draft ready");
	}

	async function sendMessage(text: string) {
		const trimmed = text.trim();
		if (!trimmed) {
			setStatus("Message required");
			return false;
		}
		setIsSending(true);
		setIsTurnActive(true);
		try {
			if (conversationId) {
				setStatus("Sending...");
				const conversation =
					await window.experimentalDesktop.sendConversationMessage(
						conversationId,
						{
							text: trimmed,
							model,
							runtimeMode: inputRuntimeMode(),
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
						text: trimmed,
						model,
						runtimeMode: inputRuntimeMode(),
						...(input.selectedFolderPath
							? { cwd: input.selectedFolderPath }
							: {}),
					});
				if (conversation) {
					hydrateConversation(conversation);
					unsubscribeRef.current?.();
					unsubscribeRef.current =
						await window.experimentalDesktop.subscribeConversationEvents(
							conversation.id,
							handleSessionEvent,
						);
				}
			}
			await refreshConversations();
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
		decision: "accept" | "acceptForSession" | "decline" | "cancel",
	) {
		if (!conversationId) {
			return;
		}
		const request = pendingRequests.find(
			(request) => request.data.requestId === requestId,
		);
		if (
			request?.data.requestKind === "user-input" &&
			decision !== "cancel"
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
				{ decision },
			);
		}
		setPendingRequests((requests) =>
			requests.filter((request) => request.data.requestId !== requestId),
		);
		setStatus(decision === "cancel" ? "Canceled" : "Running...");
		setIsTurnActive(decision !== "cancel");
	}

	function hydrateConversation(conversation: ConversationDetail) {
		setConversationId(conversation.id);
		setThreadId(conversation.providerThreadId);
		setTranscript([
			...conversation.messages.map(messageToTranscript),
			...conversation.pendingApprovals.map((approval) => ({
				id: approval.id,
				type: "approval" as const,
				requestId: approval.providerRequestId,
				requestKind: approval.kind,
				time: approval.createdAt,
			})),
		]);
		setPendingRequests(
			conversation.pendingApprovals.map((approval) => ({
				id: approval.id,
				type: "request.pending" as const,
				time: approval.createdAt,
				data: {
					requestId: approval.providerRequestId,
					approvalId: approval.id,
					method: approval.kind,
					requestKind: approval.kind,
					turnId: approval.turnId,
					itemId: approval.providerItemId,
					raw: approval.request,
				},
			})),
		);
		setIsTurnActive(
			conversation.status === "active" ||
				conversation.status === "waiting_approval",
		);
		setStatus(
			`${conversation.status} · ${formatRuntimeMode(conversation.runtimeMode)}`,
		);
	}

	function handleSessionEvent(event: ConversationEvent) {
		if (seenEventsRef.current.has(event.id)) {
			return;
		}
		seenEventsRef.current.add(event.id);
		appendEventLog(event);

		if (event.type === "message.created") {
			setTranscript((items) =>
				items.some((item) => item.id === event.data.messageId)
					? items
					: [
							...items,
							{
								id: event.data.messageId ?? event.id,
								type: "user",
								text: event.data.text,
								time: event.time,
							},
						],
			);
			setIsTurnActive(true);
			setStatus("Running...");
			void refreshConversations();
			return;
		}
		if (event.type === "assistant.delta") {
			appendAssistantDelta(event);
			setIsTurnActive(true);
			setStatus("Streaming...");
			return;
		}
		if (event.type === "assistant.completed") {
			setTranscript((items) =>
				items.map((item) =>
					item.type === "assistant" &&
					(!event.data.turnId || item.turnId === event.data.turnId)
						? { ...item, status: "done" }
						: item,
				),
			);
			setIsTurnActive(false);
			setStatus("Completed");
			void refreshConversations();
			return;
		}
		if (event.type === "message.failed") {
			setTranscript((items) => [
				...items,
				{
					id: event.id,
					type: "system",
					text: event.data.error,
					time: event.time,
				},
			]);
			setPendingRequests([]);
			setIsTurnActive(false);
			setStatus(`Failed · ${event.data.error}`);
			void refreshConversations();
			return;
		}
		if (event.type === "request.pending") {
			setPendingRequests((requests) => [...requests, event]);
			setTranscript((items) => [
				...items,
				{
					id: event.data.approvalId ?? event.id,
					type: "approval",
					requestId: event.data.requestId,
					requestKind: event.data.requestKind,
					time: event.time,
				},
			]);
			setIsTurnActive(true);
			setStatus(`Waiting for ${event.data.requestKind} approval`);
			return;
		}
		if (event.type === "request.resolved") {
			setPendingRequests((requests) =>
				requests.filter(
					(request) =>
						request.data.requestId !== event.data.requestId,
				),
			);
			setIsTurnActive(true);
			setStatus("Running...");
		}
	}

	function appendAssistantDelta(
		event: Extract<SessionEvent, { type: "assistant.delta" }>,
	) {
		setTranscript((items) => {
			const targetIndex = [...items]
				.reverse()
				.findIndex(
					(item) =>
						item.type === "assistant" &&
						(!event.data.turnId ||
							item.turnId === event.data.turnId) &&
						item.status === "streaming",
				);
			if (targetIndex === -1) {
				return [
					...items,
					{
						id: event.data.messageId ?? `assistant-${event.id}`,
						type: "assistant",
						text: event.data.text ?? "",
						status: "streaming",
						turnId: event.data.turnId,
						time: event.time,
					},
				];
			}
			const index = items.length - 1 - targetIndex;
			return items.map((item, itemIndex) =>
				itemIndex === index && item.type === "assistant"
					? { ...item, text: `${item.text}${event.data.text ?? ""}` }
					: item,
			);
		});
	}

	function appendEventLog(event: SessionEvent) {
		setEventLog((events) =>
			[
				...events,
				`${new Date(event.time).toLocaleTimeString()} ${event.type} ${summarizeSessionEvent(event)}`,
			].slice(-80),
		);
	}

	function inputRuntimeMode() {
		return input.runtimeMode;
	}

	return {
		sessionId: conversationId,
		conversationId,
		draftId,
		threadId,
		status,
		conversations,
		transcript,
		eventLog,
		pendingRequests,
		isSending,
		isTurnRunning: isSending || isTurnActive || pendingRequests.length > 0,
		createNewSession,
		openConversation,
		persistDraft,
		sendMessage,
		respondToRequest,
	};
}

function messageToTranscript(
	message: ConversationDetail["messages"][number],
): TranscriptItem {
	if (message.role === "assistant") {
		return {
			id: message.id,
			type: "assistant",
			text: message.text,
			status:
				message.status === "completed"
					? "done"
					: message.status === "failed"
						? "failed"
						: message.status === "interrupted"
							? "interrupted"
							: "streaming",
			turnId: message.turnId,
			time: message.createdAt,
		};
	}
	return {
		id: message.id,
		type: message.role === "system" ? "system" : "user",
		text: message.text,
		time: message.createdAt,
	};
}

function summarizeSessionEvent(event: SessionEvent) {
	if (event.type === "message.created") {
		return trimForLog(event.data.text);
	}
	if (event.type === "assistant.delta") {
		return trimForLog(event.data.text ?? "");
	}
	if (event.type === "assistant.completed") {
		return event.data.turnId ? `turn=${event.data.turnId}` : "";
	}
	if (event.type === "message.failed") {
		return trimForLog(event.data.error);
	}
	if (event.type === "request.pending") {
		return [
			event.data.requestKind,
			event.data.turnId ? `turn=${event.data.turnId}` : "",
			event.data.itemId ? `item=${event.data.itemId}` : "",
		]
			.filter(Boolean)
			.join(" ");
	}
	if (event.type === "request.resolved") {
		return `request=${event.data.requestId}`;
	}
	if (event.type === "provider.raw") {
		return event.data.method;
	}
	return "";
}

function trimForLog(value: string) {
	const trimmed = value.replace(/\s+/g, " ").trim();
	return trimmed.length > 140 ? `${trimmed.slice(0, 137)}...` : trimmed;
}

function formatRuntimeMode(mode: CodexRuntimeMode) {
	if (mode === "workspace-write") {
		return "Workspace Edit";
	}
	if (mode === "full-access") {
		return "Full Access";
	}
	return "Read Only";
}

function defaultAnswers(value: unknown) {
	const answers: Record<string, string[]> = {};
	if (!value || typeof value !== "object" || !("questions" in value)) {
		return answers;
	}
	const questions = (value as { questions?: unknown }).questions;
	if (!Array.isArray(questions)) {
		return answers;
	}
	for (const question of questions) {
		if (!question || typeof question !== "object") {
			continue;
		}
		const record = question as {
			id?: unknown;
			options?: unknown;
		};
		if (typeof record.id !== "string") {
			continue;
		}
		const firstOption = Array.isArray(record.options)
			? record.options.find(
					(option): option is { label: string } =>
						!!option &&
						typeof option === "object" &&
						"label" in option &&
						typeof option.label === "string",
				)
			: undefined;
		answers[record.id] = [firstOption?.label ?? "ok"];
	}
	return answers;
}
