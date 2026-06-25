import { describe, expect, it } from "vitest";
import type { ConversationTimelineRow } from "../../../conversations/conversationTimelineModel";
import {
	createTimelineListAdapterPlan,
	distanceFromTimelineBottom,
	estimateTimelineRowHeight,
	isTimelineNearBottom,
	shouldRestoreTimelineAnchor,
	TIMELINE_VIRTUALIZATION_ROW_THRESHOLD,
} from "../conversationTimelineScroll";

describe("conversationTimelineScroll", () => {
	it("classifies bottom-follow using viewport metrics", () => {
		expect(
			isTimelineNearBottom({
				scrollTop: 936,
				scrollHeight: 1200,
				clientHeight: 200,
			}),
		).toBe(true);
		expect(
			isTimelineNearBottom({
				scrollTop: 700,
				scrollHeight: 1200,
				clientHeight: 200,
			}),
		).toBe(false);
		expect(
			distanceFromTimelineBottom({
				scrollTop: 700,
				scrollHeight: 1200,
				clientHeight: 200,
			}),
		).toBe(300);
	});

	it("estimates row heights from size hints", () => {
		expect(estimateTimelineRowHeight(row("compact"))).toBe(92);
		expect(estimateTimelineRowHeight(row("message"))).toBe(160);
		expect(estimateTimelineRowHeight(row("assistant"))).toBe(220);
		expect(estimateTimelineRowHeight(row("tool"))).toBe(280);
		expect(estimateTimelineRowHeight(row("media"))).toBe(360);
		expect(estimateTimelineRowHeight(row("large"))).toBe(520);
	});

	it("marks large timelines for TanStack virtualizer mode", () => {
		const small = createTimelineListAdapterPlan([row("message")]);
		const large = createTimelineListAdapterPlan(
			Array.from({ length: TIMELINE_VIRTUALIZATION_ROW_THRESHOLD }, (_, index) =>
				row("message", `row-${index}`),
			),
		);

		expect(small).toEqual(
			expect.objectContaining({
				mode: "native",
				virtualizationRecommended: false,
				rowCount: 1,
			}),
		);
		expect(large).toEqual(
			expect.objectContaining({
				mode: "virtual-ready",
				virtualizationRecommended: true,
				rowCount: TIMELINE_VIRTUALIZATION_ROW_THRESHOLD,
			}),
		);
	});

	it("restores anchors only when the user is not following bottom", () => {
		expect(
			shouldRestoreTimelineAnchor({
				wasFollowingBottom: true,
				previousRowCount: 4,
				nextRowCount: 5,
				anchor: { rowId: "row-2", topOffset: 24 },
			}),
		).toBe(false);
		expect(
			shouldRestoreTimelineAnchor({
				wasFollowingBottom: false,
				previousRowCount: 4,
				nextRowCount: 5,
				anchor: { rowId: "row-2", topOffset: 24 },
			}),
		).toBe(true);
		expect(
			shouldRestoreTimelineAnchor({
				wasFollowingBottom: false,
				previousRowCount: 4,
				nextRowCount: 3,
				anchor: { rowId: "row-2", topOffset: 24 },
			}),
		).toBe(false);
	});
});

function row(
	sizeHint: ConversationTimelineRow["sizeHint"],
	id = `row-${sizeHint}`,
): ConversationTimelineRow {
	return {
		id,
		kind: "message",
		semanticKind: "user_message",
		anchorId: id,
		signature: id,
		sizeHint,
		role: "user",
		status: "completed",
		text: "Hello",
		time: "2026-06-24T00:00:00.000Z",
		parts: [],
	};
}
