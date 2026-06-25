import type { ConversationTimelineRow } from "../../conversations/conversationTimelineModel";

export const BOTTOM_FOLLOW_THRESHOLD_PX = 64;
export const TIMELINE_VIRTUALIZATION_ROW_THRESHOLD = 180;

export type TimelineViewportMetrics = {
	scrollTop: number;
	scrollHeight: number;
	clientHeight: number;
};

export type TimelineListAdapterMode = "native" | "virtual-ready";

export type TimelineListAdapterPlan = {
	mode: TimelineListAdapterMode;
	rowCount: number;
	virtualizationRecommended: boolean;
	estimatedTotalHeight: number;
};

export type TimelineScrollAnchor = {
	rowId: string;
	topOffset: number;
};

export function isTimelineNearBottom(
	metrics: TimelineViewportMetrics,
	threshold = BOTTOM_FOLLOW_THRESHOLD_PX,
) {
	return distanceFromTimelineBottom(metrics) <= threshold;
}

export function distanceFromTimelineBottom(metrics: TimelineViewportMetrics) {
	return metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight;
}

export function createTimelineListAdapterPlan(
	rows: ConversationTimelineRow[],
): TimelineListAdapterPlan {
	const estimatedTotalHeight = rows.reduce(
		(total, row) => total + estimateTimelineRowHeight(row),
		0,
	);
	const virtualizationRecommended =
		rows.length >= TIMELINE_VIRTUALIZATION_ROW_THRESHOLD ||
		estimatedTotalHeight >= 36_000;
	return {
		mode: virtualizationRecommended ? "virtual-ready" : "native",
		rowCount: rows.length,
		virtualizationRecommended,
		estimatedTotalHeight,
	};
}

export function estimateTimelineRowHeight(row: ConversationTimelineRow) {
	if (row.sizeHint === "large") {
		return 520;
	}
	if (row.sizeHint === "media") {
		return 360;
	}
	if (row.sizeHint === "tool") {
		return 280;
	}
	if (row.sizeHint === "assistant") {
		return 220;
	}
	if (row.sizeHint === "message") {
		return 160;
	}
	return 92;
}

export function shouldRestoreTimelineAnchor(input: {
	wasFollowingBottom: boolean;
	previousRowCount: number;
	nextRowCount: number;
	anchor?: TimelineScrollAnchor;
}) {
	if (input.wasFollowingBottom) {
		return false;
	}
	if (!input.anchor) {
		return false;
	}
	return input.nextRowCount >= input.previousRowCount;
}
