import type {
	ConversationTimelinePart,
	ConversationTimelineRow,
} from "../../conversations/conversationTimelineModel";

export type MessageRow = Extract<ConversationTimelineRow, { kind: "message" }>;

export function timelinePartPlainText(part: ConversationTimelinePart) {
	if (part.kind === "text") {
		return part.text;
	}
	if (part.kind === "file" || part.kind === "image") {
		return [part.label, part.path, part.mimeType].filter(Boolean).join("\n");
	}
	if (part.kind === "context") {
		return [part.label, part.path].filter(Boolean).join("\n");
	}
	if (
		part.kind === "tool" ||
		part.kind === "approval" ||
		part.kind === "raw"
	) {
		return [part.label, part.text ?? stringifyMetadata(part.metadata)]
			.filter(Boolean)
			.join("\n");
	}
	return part.id;
}

export function timelineMessagePlainText(row: MessageRow) {
	if (row.parts.length === 0) {
		return row.text;
	}
	return row.parts
		.map(timelinePartPlainText)
		.map((value) => value.trim())
		.filter(Boolean)
		.join("\n\n");
}

export function timelineAssistantReplyText(row: MessageRow) {
	return row.parts
		.filter((part) => part.kind === "text")
		.map((part) => part.text.trim())
		.filter(Boolean)
		.join("\n\n") || row.text.trim();
}

export function assistantFooterLabel(row: MessageRow, now = Date.now()) {
	if (row.status === "streaming" || row.status === "pending") {
		return row.startedAt
			? `Working · ${formatDurationSince(row.startedAt, now)}`
			: "Working";
	}
	if (row.startedAt && row.completedAt) {
		const duration = formatDurationBetween(row.startedAt, row.completedAt);
		if (row.status === "failed") {
			return `Failed after ${duration}`;
		}
		if (row.status === "interrupted") {
			return `Interrupted after ${duration}`;
		}
		return `Completed in ${duration}`;
	}
	if (row.status === "failed") {
		return "Failed";
	}
	if (row.status === "interrupted") {
		return "Interrupted";
	}
	return `Completed at ${formatTimelineTime(row.time)}`;
}

export function formatDurationBetween(startedAt: string, completedAt: string) {
	return formatDurationMs(Date.parse(completedAt) - Date.parse(startedAt));
}

export function formatDurationSince(startedAt: string, now = Date.now()) {
	return formatDurationMs(now - Date.parse(startedAt));
}

export function formatTimelineTime(value: string) {
	return new Date(value).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});
}

function formatDurationMs(value: number) {
	if (!Number.isFinite(value)) {
		return "0s";
	}
	const seconds = Math.max(0, Math.round(value / 1000));
	if (seconds < 60) {
		return `${seconds}s`;
	}
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	if (minutes < 60) {
		return remainingSeconds > 0
			? `${minutes}m ${remainingSeconds}s`
			: `${minutes}m`;
	}
	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function stringifyMetadata(value: unknown) {
	try {
		return JSON.stringify(value ?? {}, null, 2);
	} catch {
		return String(value);
	}
}
