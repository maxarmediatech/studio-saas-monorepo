import type {
	CodexRuntimeMode,
	ConversationDetail,
	ConversationEvent,
	SessionEvent,
} from "../../preload/types";
import type { PendingRequest, TranscriptItem } from "../app/types";

export type ConversationProjectionState = {
	transcript: TranscriptItem[];
	pendingRequests: PendingRequest[];
	isTurnActive: boolean;
	status: string;
};

export type ConversationEventProjectionResult = {
	state: ConversationProjectionState;
	shouldRefreshConversations: boolean;
};

export function createEmptyConversationProjection(
	status = "No conversation",
): ConversationProjectionState {
	return {
		transcript: [],
		pendingRequests: [],
		isTurnActive: false,
		status,
	};
}

export function projectConversationDetail(
	conversation: ConversationDetail,
): ConversationProjectionState {
	return {
		transcript: [
			...conversation.messages.map(messageToTranscript),
			...conversation.pendingApprovals.map(approvalToTranscript),
		],
		pendingRequests: conversation.pendingApprovals.map(approvalToRequest),
		isTurnActive:
			conversation.status === "active" ||
			conversation.status === "waiting_approval",
		status: `${conversation.status} · ${formatRuntimeMode(conversation.runtimeMode)}`,
	};
}

export function applyConversationEventProjection(
	state: ConversationProjectionState,
	event: ConversationEvent,
): ConversationEventProjectionResult {
	if (event.type === "message.created") {
		return {
			state: {
				...state,
				transcript: state.transcript.some(
					(item) => item.id === event.data.messageId,
				)
					? state.transcript
					: [
							...state.transcript,
							{
								id: event.data.messageId ?? event.id,
								type: "user",
								text: event.data.text,
								time: event.time,
							},
						],
				isTurnActive: true,
				status: "Running...",
			},
			shouldRefreshConversations: true,
		};
	}
	if (event.type === "assistant.delta") {
		return {
			state: {
				...state,
				transcript: appendAssistantDelta(state.transcript, event),
				isTurnActive: true,
				status: "Streaming...",
			},
			shouldRefreshConversations: false,
		};
	}
	if (event.type === "assistant.completed") {
		return {
			state: {
				...state,
				transcript: state.transcript.map((item) =>
					item.type === "assistant" &&
					(!event.data.turnId || item.turnId === event.data.turnId)
						? { ...item, status: "done" }
						: item,
				),
				isTurnActive: false,
				status: "Completed",
			},
			shouldRefreshConversations: true,
		};
	}
	if (event.type === "message.failed") {
		return {
			state: {
				...state,
				transcript: [
					...state.transcript,
					{
						id: event.id,
						type: "system",
						text: event.data.error,
						time: event.time,
					},
				],
				pendingRequests: [],
				isTurnActive: false,
				status: `Failed · ${event.data.error}`,
			},
			shouldRefreshConversations: true,
		};
	}
	if (event.type === "turn.interrupted") {
		return {
			state: {
				...state,
				transcript: state.transcript.map((item) =>
					item.type === "assistant" &&
					(!event.data.turnId || item.turnId === event.data.turnId)
						? { ...item, status: "interrupted" }
						: item,
				),
				pendingRequests: [],
				isTurnActive: false,
				status: event.data.message,
			},
			shouldRefreshConversations: true,
		};
	}
	if (event.type === "request.pending") {
		return {
			state: {
				...state,
				pendingRequests: [...state.pendingRequests, event],
				transcript: [
					...state.transcript,
					{
						id: event.data.approvalId ?? event.id,
						type: "approval",
						requestId: event.data.requestId,
						requestKind: event.data.requestKind,
						time: event.time,
					},
				],
				isTurnActive: true,
				status: `Waiting for ${event.data.requestKind} approval`,
			},
			shouldRefreshConversations: false,
		};
	}
	if (event.type === "request.resolved") {
		return {
			state: {
				...state,
				pendingRequests: state.pendingRequests.filter(
					(request) =>
						request.data.requestId !== event.data.requestId,
				),
				isTurnActive: true,
				status: "Running...",
			},
			shouldRefreshConversations: false,
		};
	}
	if (event.type === "session.compacted") {
		return {
			state: {
				...state,
				transcript: [
					...state.transcript,
					{
						id: event.id,
						type: "system",
						text: `Session compacted · ${event.data.tokensBefore.toLocaleString()} tokens summarized`,
						time: event.time,
					},
				],
				status: "Session compacted",
			},
			shouldRefreshConversations: true,
		};
	}
	return { state, shouldRefreshConversations: false };
}

export function summarizeConversationEvent(event: SessionEvent) {
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
	if (event.type === "turn.interrupted") {
		return trimForLog(event.data.message);
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
	if (event.type === "session.compacted") {
		return `${event.data.reason} ${event.data.tokensBefore.toLocaleString()} tokens`;
	}
	return "";
}

function appendAssistantDelta(
	transcript: TranscriptItem[],
	event: Extract<SessionEvent, { type: "assistant.delta" }>,
) {
	const targetIndex = [...transcript]
		.reverse()
		.findIndex(
			(item) =>
				item.type === "assistant" &&
				(!event.data.turnId || item.turnId === event.data.turnId) &&
				item.status === "streaming",
		);
	if (targetIndex === -1) {
		return [
			...transcript,
			{
				id: event.data.messageId ?? `assistant-${event.id}`,
				type: "assistant" as const,
				text: event.data.text ?? "",
				status: "streaming" as const,
				turnId: event.data.turnId,
				time: event.time,
			},
		];
	}
	const index = transcript.length - 1 - targetIndex;
	return transcript.map((item, itemIndex) =>
		itemIndex === index && item.type === "assistant"
			? { ...item, text: `${item.text}${event.data.text ?? ""}` }
			: item,
	);
}

function approvalToTranscript(
	approval: ConversationDetail["pendingApprovals"][number],
): TranscriptItem {
	return {
		id: approval.id,
		type: "approval",
		requestId: approval.providerRequestId,
		requestKind: approval.kind,
		time: approval.createdAt,
	};
}

function approvalToRequest(
	approval: ConversationDetail["pendingApprovals"][number],
): PendingRequest {
	return {
		id: approval.id,
		type: "request.pending",
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
