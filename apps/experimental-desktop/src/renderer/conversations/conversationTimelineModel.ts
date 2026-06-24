import type { ConversationDetail } from "../../preload/types";
import type { PendingRequest, TranscriptItem } from "../app/types";

export type ConversationTimelinePart =
	| {
			id: string;
			kind: "text";
			text: string;
	  }
	| {
			id: string;
			kind: "file" | "image";
			label: string;
			path?: string;
			mimeType?: string;
	  }
	| {
			id: string;
			kind: "context";
			label: string;
			path: string;
			contextType?: string;
	  }
	| {
			id: string;
			kind: "tool" | "approval" | "raw";
			label: string;
			text?: string;
			metadata?: unknown;
	  };

export type ConversationTimelineRow =
	| {
			id: string;
			kind: "message";
			role: "user" | "assistant" | "system";
			status?:
				| "pending"
				| "streaming"
				| "completed"
				| "failed"
				| "interrupted";
			text: string;
			time: string;
			turnId?: string;
			parts: ConversationTimelinePart[];
	  }
	| {
			id: string;
			kind: "request";
			requestId: string;
			requestKind: PendingRequest["data"]["requestKind"];
			time: string;
			pending: boolean;
			raw?: unknown;
	  }
	| {
			id: string;
			kind: "event";
			tone: "info" | "error" | "compaction";
			title: string;
			text?: string;
			time?: string;
	  };

export type ConversationTimelineModel = {
	rows: ConversationTimelineRow[];
	pendingRequests: PendingRequest[];
};

export function projectConversationTimeline(input: {
	conversation?: ConversationDetail;
	transcript: TranscriptItem[];
	pendingRequests: PendingRequest[];
	eventLog?: string[];
}): ConversationTimelineModel {
	const partsByMessage = new Map(
		(input.conversation?.messages ?? []).map(
			(message) =>
				[
					message.id,
					projectMessageParts(message.parts ?? []),
				] as const,
		),
	);
	const pendingByRequestId = new Map(
		input.pendingRequests.map((request) => [
			request.data.requestId,
			request,
		]),
	);
	const rows = input.transcript.flatMap((item): ConversationTimelineRow[] => {
		if (item.type === "approval") {
			const pending = pendingByRequestId.get(item.requestId);
			return [{
				id: item.id,
				kind: "request",
				requestId: item.requestId,
				requestKind: item.requestKind,
				time: item.time,
				pending: Boolean(pending),
				raw: pending?.data.raw,
			}];
		}
		if (item.type === "system") {
			return [{
				id: item.id,
				kind: "event",
				tone: eventTone(item.text),
				title: eventTitle(item.text),
				text: item.text,
				time: item.time,
			}];
		}
		const parts = partsByMessage.get(item.id) ?? fallbackTextPart(item);
		if (item.type === "assistant" && parts.length === 0) {
			return [];
		}
		return [{
			id: item.id,
			kind: "message",
			role: item.type,
			status:
				item.type === "assistant"
					? statusFromTranscript(item.status)
					: "completed",
			text: item.text,
			time: item.time,
			turnId: item.type === "assistant" ? item.turnId : undefined,
			parts,
		}];
	});

	return {
		rows,
		pendingRequests: input.pendingRequests,
	};
}

function projectMessageParts(
	parts: NonNullable<ConversationDetail["messages"][number]["parts"]>,
) {
	const rows: ConversationTimelinePart[] = [];
	for (const part of parts) {
		if (part.type === "text") {
			rows.push(...partsFromComposerPayload(part.id, part.json));
			if (part.text?.trim()) {
				rows.push({ id: part.id, kind: "text", text: part.text });
			}
			continue;
		}
		if (part.type === "tool_call" || part.type === "tool_result") {
			rows.push({
				id: part.id,
				kind: "tool",
				label: part.type === "tool_call" ? "Tool call" : "Tool result",
				text: part.text,
				metadata: part.json,
			});
			continue;
		}
		if (part.type === "approval") {
			rows.push({
				id: part.id,
				kind: "approval",
				label: "Approval",
				text: part.text,
				metadata: part.json,
			});
			continue;
		}
		rows.push({
			id: part.id,
			kind: "raw",
			label: "Provider event",
			text: part.text,
			metadata: part.json,
		});
	}
	return rows;
}

function partsFromComposerPayload(id: string, value: unknown) {
	const payload = readRecord(value)?.composerPayload;
	const parts = readRecord(payload)?.parts;
	if (!Array.isArray(parts)) {
		return [];
	}
	return parts.flatMap((part, index): ConversationTimelinePart[] => {
		const record = readRecord(part);
		if (!record) {
			return [];
		}
		const type = record?.type;
		if (type === "attachment_file" || type === "attachment_image") {
			return [
				{
					id: `${id}:attachment:${index}`,
					kind: type === "attachment_image" ? "image" : "file",
					label: readString(record.name) ?? "Attachment",
					path: readString(record.path),
					mimeType: readString(record.mimeType),
				},
			];
		}
		if (
			type === "context_file" ||
			type === "context_directory" ||
			type === "context_workspace" ||
			type === "context_skill" ||
			type === "context_terminal"
		) {
			return [
				{
					id: `${id}:context:${index}`,
					kind: "context",
					label: readString(record.label) ?? "Context",
					path: readString(record.path) ?? "",
					contextType: type.replace("context_", ""),
				},
			];
		}
		return [];
	});
}

function fallbackTextPart(
	item: Extract<TranscriptItem, { type: "user" | "assistant" }>,
) {
	return item.text.trim()
		? [{ id: `${item.id}:text`, kind: "text" as const, text: item.text }]
		: [];
}

function statusFromTranscript(
	status: Extract<TranscriptItem, { type: "assistant" }>["status"],
) {
	return status === "done" ? "completed" : status;
}

function eventTone(text: string): "info" | "error" | "compaction" {
	const lower = text.toLowerCase();
	if (
		lower.includes("failed") ||
		lower.includes("error") ||
		lower.includes("usage limit") ||
		lower.includes("rate limit") ||
		lower.includes("credits") ||
		lower.includes("boom")
	) {
		return "error";
	}
	if (lower.includes("compacted")) {
		return "compaction";
	}
	return "info";
}

function eventTitle(text: string) {
	const lower = text.toLowerCase();
	if (
		lower.includes("usage limit") ||
		lower.includes("rate limit") ||
		lower.includes("credits")
	) {
		return "Usage limit reached";
	}
	if (lower.includes("compacted")) {
		return "Compaction";
	}
	if (lower.includes("failed") || lower.includes("error")) {
		return "Error";
	}
	return "System";
}

function readRecord(value: unknown) {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}

function readString(value: unknown) {
	return typeof value === "string" && value.trim() ? value : undefined;
}
