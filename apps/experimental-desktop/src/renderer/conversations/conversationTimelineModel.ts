import type { ConversationDetail } from "../../preload/types";
import type { PendingRequest, TranscriptItem } from "../app/types";

export type ConversationTimelineSemanticKind =
	| "user_message"
	| "assistant_turn"
	| "system_notice"
	| "approval"
	| "error"
	| "compaction"
	| "activity_group"
	| "app_action"
	| "media_grid";

export type ConversationTimelineSizeHint =
	| "compact"
	| "message"
	| "assistant"
	| "tool"
	| "media"
	| "large";

export type ConversationTimelineBase = {
	id: string;
	semanticKind: ConversationTimelineSemanticKind;
	anchorId: string;
	signature: string;
	sizeHint: ConversationTimelineSizeHint;
};

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
	| (ConversationTimelineBase & {
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
			startedAt?: string;
			completedAt?: string;
			parts: ConversationTimelinePart[];
	  })
	| (ConversationTimelineBase & {
			kind: "request";
			requestId: string;
			requestKind: PendingRequest["data"]["requestKind"];
			time: string;
			pending: boolean;
			raw?: unknown;
	  })
	| (ConversationTimelineBase & {
			kind: "event";
			tone: "info" | "error" | "compaction";
			title: string;
			text?: string;
			time?: string;
	  })
	| (ConversationTimelineBase & {
			kind: "activityGroup";
			title: string;
			summary: string;
			items: string[];
			time?: string;
	  })
	| (ConversationTimelineBase & {
			kind: "appAction";
			actionKind: string;
			title: string;
			description?: string;
			status: "pending" | "running" | "completed" | "failed";
			time?: string;
			raw?: unknown;
	  })
	| (ConversationTimelineBase & {
			kind: "mediaGrid";
			title: string;
			items: Array<{
				id: string;
				label: string;
				path?: string;
				mimeType?: string;
			}>;
			time?: string;
	  });

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
				[message.id, projectMessageParts(message.parts ?? [])] as const,
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
			return [
				{
					id: item.id,
					kind: "request",
					semanticKind: "approval",
					anchorId: item.id,
					signature: timelineSignature([
						"request",
						item.id,
						item.requestId,
						item.requestKind,
						Boolean(pending),
						pending?.data.raw,
					]),
					sizeHint: "compact",
					requestId: item.requestId,
					requestKind: item.requestKind,
					time: item.time,
					pending: Boolean(pending),
					raw: pending?.data.raw,
				},
			];
		}
		if (item.type === "system") {
			const tone = eventTone(item.text);
			return [
				{
					id: item.id,
					kind: "event",
					semanticKind: eventSemanticKind(tone),
					anchorId: item.id,
					signature: timelineSignature([
						"event",
						item.id,
						tone,
						eventTitle(item.text),
						item.text,
					]),
					sizeHint: "compact",
					tone,
					title: eventTitle(item.text),
					text: item.text,
					time: item.time,
				},
			];
		}
		const parts = partsByMessage.get(item.id) ?? fallbackTextPart(item);
		if (item.type === "assistant" && parts.length === 0) {
			return [];
		}
		const status =
			item.type === "assistant"
				? statusFromTranscript(item.status)
				: "completed";
		return [
			{
				id: item.id,
				kind: "message",
				semanticKind: messageSemanticKind(item.type),
				anchorId: item.id,
				signature: timelineSignature([
					"message",
					item.id,
					item.type,
					status,
					item.text,
					item.type === "assistant" ? item.turnId : undefined,
					item.type === "assistant" ? item.startedAt : undefined,
					item.type === "assistant" ? item.completedAt : undefined,
					parts.map(partSignature),
				]),
				sizeHint: messageSizeHint(item.type, parts),
				role: item.type,
				status,
				text: item.text,
				time: item.time,
				turnId: item.type === "assistant" ? item.turnId : undefined,
				startedAt:
					item.type === "assistant" ? item.startedAt : undefined,
				completedAt:
					item.type === "assistant" ? item.completedAt : undefined,
				parts,
			},
		];
	});

	return {
		rows: projectOperationalTimelineRows(rows),
		pendingRequests: input.pendingRequests,
	};
}

function projectOperationalTimelineRows(
	rows: ConversationTimelineRow[],
): ConversationTimelineRow[] {
	return rows.flatMap((row): ConversationTimelineRow[] => {
		if (row.kind !== "message") {
			return [row];
		}
		const operationalRows = [
			projectMediaGridRow(row),
			projectActivityGroupRow(row),
		].filter((item): item is ConversationTimelineRow => Boolean(item));
		return operationalRows.length > 0 ? [row, ...operationalRows] : [row];
	});
}

function projectMediaGridRow(
	row: Extract<ConversationTimelineRow, { kind: "message" }>,
): ConversationTimelineRow | undefined {
	const images = row.parts.filter(
		(
			part,
		): part is Extract<
			ConversationTimelinePart,
			{ kind: "file" | "image" }
		> => part.kind === "image",
	);
	if (images.length === 0) {
		return undefined;
	}
	return {
		id: `${row.id}:media-grid`,
		kind: "mediaGrid",
		semanticKind: "media_grid",
		anchorId: row.anchorId,
		signature: timelineSignature([
			"mediaGrid",
			row.id,
			images.map((image) => [image.id, image.label, image.path]),
		]),
		sizeHint: "media",
		title: `${images.length} image${images.length === 1 ? "" : "s"}`,
		items: images.map((image) => ({
			id: image.id,
			label: image.label,
			path: image.path,
			mimeType: image.mimeType,
		})),
		time: row.time,
	};
}

function projectActivityGroupRow(
	row: Extract<ConversationTimelineRow, { kind: "message" }>,
): ConversationTimelineRow | undefined {
	const providerParts = row.parts.filter(
		(
			part,
		): part is Extract<
			ConversationTimelinePart,
			{ kind: "tool" | "approval" | "raw" }
		> =>
			part.kind === "tool" ||
			part.kind === "approval" ||
			part.kind === "raw",
	);
	if (providerParts.length < 2) {
		return undefined;
	}
	return {
		id: `${row.id}:activity-group`,
		kind: "activityGroup",
		semanticKind: "activity_group",
		anchorId: row.anchorId,
		signature: timelineSignature([
			"activityGroup",
			row.id,
			providerParts.map((part) => [part.id, part.kind, part.label]),
		]),
		sizeHint: "compact",
		title: "Provider activity",
		summary: `${providerParts.length} provider events captured for this turn`,
		items: providerParts.slice(0, 5).map((part) => part.label),
		time: row.time,
	};
}

export function createConversationTimelineRowStabilizer() {
	let previousRows = new Map<string, ConversationTimelineRow>();

	return function stabilizeTimelineRows(rows: ConversationTimelineRow[]) {
		const nextRows = new Map<string, ConversationTimelineRow>();
		const stableRows = rows.map((row) => {
			const previous = previousRows.get(row.id);
			const stable =
				previous?.signature === row.signature &&
				previous.kind === row.kind
					? previous
					: row;
			nextRows.set(row.id, stable);
			return stable;
		});
		previousRows = nextRows;
		return stableRows;
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

function messageSemanticKind(
	role: "user" | "assistant",
): ConversationTimelineSemanticKind {
	return role === "user" ? "user_message" : "assistant_turn";
}

function eventSemanticKind(
	tone: "info" | "error" | "compaction",
): ConversationTimelineSemanticKind {
	if (tone === "error") {
		return "error";
	}
	if (tone === "compaction") {
		return "compaction";
	}
	return "system_notice";
}

function messageSizeHint(
	role: "user" | "assistant",
	parts: ConversationTimelinePart[],
): ConversationTimelineSizeHint {
	if (parts.some((part) => part.kind === "image")) {
		return "media";
	}
	if (parts.some((part) => part.kind === "tool" || part.kind === "raw")) {
		return "tool";
	}
	return role === "assistant" ? "assistant" : "message";
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

function partSignature(part: ConversationTimelinePart) {
	if (part.kind === "text") {
		return timelineSignature([part.id, part.kind, part.text]);
	}
	if (part.kind === "file" || part.kind === "image") {
		return timelineSignature([
			part.id,
			part.kind,
			part.label,
			part.path,
			part.mimeType,
		]);
	}
	if (part.kind === "context") {
		return timelineSignature([
			part.id,
			part.kind,
			part.label,
			part.path,
			part.contextType,
		]);
	}
	if (
		part.kind === "tool" ||
		part.kind === "approval" ||
		part.kind === "raw"
	) {
		return timelineSignature([
			part.id,
			part.kind,
			part.label,
			part.text,
			part.metadata,
		]);
	}
	return timelineSignature([part.id, part.kind]);
}

function timelineSignature(values: unknown[]) {
	return values.map(signatureValue).join("|");
}

function signatureValue(value: unknown): string {
	if (value === undefined) {
		return "undefined";
	}
	if (value === null) {
		return "null";
	}
	if (typeof value === "string") {
		return value;
	}
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

function readRecord(value: unknown) {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}

function readString(value: unknown) {
	return typeof value === "string" && value.trim() ? value : undefined;
}
