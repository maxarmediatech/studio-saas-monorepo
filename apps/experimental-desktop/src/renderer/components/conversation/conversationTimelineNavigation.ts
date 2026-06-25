import type { ConversationTimelineRow } from "../../conversations/conversationTimelineModel";

export type TimelineSearchMatch = {
	rowId: string;
	index: number;
	label: string;
};

export type TimelineLandmark = {
	rowId: string;
	index: number;
	label: string;
	preview: string;
	kind: ConversationTimelineRow["kind"];
	importance: "primary" | "secondary";
};

export function buildTimelineSearchMatches(
	rows: ConversationTimelineRow[],
	query: string,
): TimelineSearchMatch[] {
	const needle = normalizeSearchText(query);
	if (!needle) {
		return [];
	}
	return rows.flatMap((row, index) => {
		const text = normalizeSearchText(timelineRowSearchText(row));
		return text.includes(needle)
			? [{ rowId: row.id, index, label: timelineRowLabel(row) }]
			: [];
	});
}

export function buildTimelineLandmarks(
	rows: ConversationTimelineRow[],
	maxLandmarks = 120,
): TimelineLandmark[] {
	const candidates = rows.flatMap((row, index) => {
		const landmark = timelineRowLandmark(row, index, rows.length);
		return landmark ? [landmark] : [];
	});
	if (candidates.length <= maxLandmarks) {
		return candidates;
	}
	const selectedIndexes = new Set<number>([0, candidates.length - 1]);
	const slots = Math.max(0, maxLandmarks - selectedIndexes.size);
	const lastIndex = candidates.length - 1;
	for (let slot = 1; slot <= slots; slot += 1) {
		selectedIndexes.add(Math.round((slot * lastIndex) / (slots + 1)));
	}
	return Array.from(selectedIndexes)
		.sort((first, second) => first - second)
		.map((index) => candidates[index])
		.filter((item): item is TimelineLandmark => Boolean(item));
}

export function timelineRowSearchText(row: ConversationTimelineRow) {
	const values: string[] = [row.kind, row.semanticKind, row.sizeHint];
	if (row.kind === "message") {
		values.push(row.role, row.status ?? "", row.text);
		for (const part of row.parts) {
			values.push(part.kind);
			appendSearchValue(values, "label" in part ? part.label : undefined);
			appendSearchValue(values, "path" in part ? part.path : undefined);
			appendSearchValue(values, "mimeType" in part ? part.mimeType : undefined);
			appendSearchValue(values, "contextType" in part ? part.contextType : undefined);
			appendSearchValue(values, "text" in part ? part.text : undefined);
		}
	}
	if (row.kind === "request") {
		values.push(row.pending ? "pending" : "resolved");
	}
	if (row.kind === "event") {
		values.push(row.tone, row.title, row.text ?? "");
	}
	if (row.kind === "activityGroup") {
		values.push(row.title, row.summary, ...row.items);
	}
	if (row.kind === "appAction") {
		values.push(row.actionKind, row.title, row.description ?? "", row.status);
	}
	if (row.kind === "mediaGrid") {
		values.push(
			row.title,
			...row.items.flatMap((item) => [
				item.label,
				item.path ?? "",
				item.mimeType ?? "",
			]),
		);
	}
	return values.filter(Boolean).join(" ");
}

export function timelineRowLabel(row: ConversationTimelineRow) {
	if (row.kind === "message") {
		if (row.role === "user") return "User message";
		if (row.role === "assistant") return "Assistant message";
		return "System message";
	}
	if (row.kind === "request") return `${row.requestKind} approval`;
	if (row.kind === "event") return row.title;
	if (row.kind === "activityGroup") return row.title;
	if (row.kind === "appAction") return row.title;
	return row.title;
}

function timelineRowLandmark(
	row: ConversationTimelineRow,
	index: number,
	rowCount: number,
): TimelineLandmark | undefined {
	const firstOrLast = index === 0 || index === rowCount - 1;
	const important =
		firstOrLast ||
		row.kind !== "message" ||
		(row.kind === "message" && row.role === "user");
	if (!important) {
		return undefined;
	}
	return {
		rowId: row.id,
		index,
		kind: row.kind,
		label: timelineRowLabel(row),
		preview: previewText(timelineRowSearchText(row)),
		importance: row.kind === "message" && row.role !== "user" ? "secondary" : "primary",
	};
}

function appendSearchValue(values: string[], value: unknown) {
	if (typeof value === "string" && value.trim()) {
		values.push(value);
	}
}

function normalizeSearchText(value: string) {
	return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function previewText(value: string) {
	const normalized = value.trim().replace(/\s+/g, " ");
	return normalized.length > 120 ? `${normalized.slice(0, 120)}…` : normalized;
}
