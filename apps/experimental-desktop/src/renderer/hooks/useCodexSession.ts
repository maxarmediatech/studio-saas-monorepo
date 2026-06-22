import { useEffect, useRef, useState } from "react";
import type { CodexRuntimeMode, SessionEvent } from "../../preload/types";
import type { PendingRequest, TranscriptItem } from "../app/types";

const model = "gpt-5.4-mini";

export function useCodexSession(input: {
	runtimeMode: CodexRuntimeMode;
	selectedFolderPath?: string;
}) {
	const [sessionId, setSessionId] = useState<string>();
	const [threadId, setThreadId] = useState<string>();
	const [status, setStatus] = useState("No session");
	const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
	const [eventLog, setEventLog] = useState<string[]>([]);
	const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>(
		[],
	);
	const [isSending, setIsSending] = useState(false);
	const unsubscribeRef = useRef<(() => void) | undefined>(undefined);
	const seenEventsRef = useRef(new Set<string>());

	useEffect(() => {
		return () => unsubscribeRef.current?.();
	}, []);

	async function ensureSession() {
		if (sessionId) {
			return sessionId;
		}
		setStatus("Creating session...");
		const session = await window.experimentalDesktop.createSession({
			model,
			runtimeMode: input.runtimeMode,
			...(input.selectedFolderPath
				? { cwd: input.selectedFolderPath }
				: {}),
		});
		setSessionId(session.id);
		setThreadId(session.threadId);
		unsubscribeRef.current?.();
		unsubscribeRef.current =
			await window.experimentalDesktop.subscribeSessionEvents(
				session.id,
				handleSessionEvent,
			);
		setStatus(`Ready · ${formatRuntimeMode(input.runtimeMode)}`);
		return session.id;
	}

	async function createNewSession() {
		unsubscribeRef.current?.();
		seenEventsRef.current.clear();
		setTranscript([]);
		setEventLog([]);
		setPendingRequests([]);
		setStatus("Creating session...");
		const session = await window.experimentalDesktop.createSession({
			model,
			runtimeMode: input.runtimeMode,
			...(input.selectedFolderPath
				? { cwd: input.selectedFolderPath }
				: {}),
		});
		setSessionId(session.id);
		setThreadId(session.threadId);
		unsubscribeRef.current =
			await window.experimentalDesktop.subscribeSessionEvents(
				session.id,
				handleSessionEvent,
			);
		setStatus(`Ready · ${formatRuntimeMode(input.runtimeMode)}`);
	}

	async function sendMessage(text: string) {
		const trimmed = text.trim();
		if (!trimmed) {
			setStatus("Message required");
			return false;
		}
		setIsSending(true);
		try {
			const activeSessionId = await ensureSession();
			const now = new Date().toISOString();
			setTranscript((items) => [
				...items,
				{
					id: `user-${crypto.randomUUID()}`,
					type: "user",
					text: trimmed,
					time: now,
				},
			]);
			setStatus("Sending...");
			await window.experimentalDesktop.sendSessionMessage(
				activeSessionId,
				{
					text: trimmed,
					model,
				},
			);
			setStatus("Running...");
			return true;
		} catch (error) {
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
		if (!sessionId) {
			return;
		}
		await window.experimentalDesktop.respondSessionRequest(
			sessionId,
			requestId,
			{
				decision,
			},
		);
		setPendingRequests((requests) =>
			requests.filter((request) => request.data.requestId !== requestId),
		);
	}

	function handleSessionEvent(event: SessionEvent) {
		if (seenEventsRef.current.has(event.id)) {
			return;
		}
		seenEventsRef.current.add(event.id);
		appendEventLog(event);

		if (event.type === "message.created") {
			setStatus("Running...");
			return;
		}
		if (event.type === "assistant.delta") {
			appendAssistantDelta(event);
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
			setStatus("Completed");
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
			setStatus(`Failed · ${event.data.error}`);
			return;
		}
		if (event.type === "request.pending") {
			setPendingRequests((requests) => [...requests, event]);
			setTranscript((items) => [
				...items,
				{
					id: event.id,
					type: "approval",
					requestId: event.data.requestId,
					requestKind: event.data.requestKind,
					time: event.time,
				},
			]);
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
						id: `assistant-${event.id}`,
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

	return {
		sessionId,
		threadId,
		status,
		transcript,
		eventLog,
		pendingRequests,
		isSending,
		createNewSession,
		sendMessage,
		respondToRequest,
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
