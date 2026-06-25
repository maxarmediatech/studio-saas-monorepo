import { describe, expect, it } from "vitest";
import type { ConversationTimelineRow } from "../../../conversations/conversationTimelineModel";
import {
	assistantFooterLabel,
	formatDurationBetween,
	timelineAssistantReplyText,
	timelineMessagePlainText,
} from "../timelineText";

describe("timelineText", () => {
	it("builds copy text from all visible message parts", () => {
		const row = messageRow({
			parts: [
				{ id: "text-1", kind: "text", text: "Hello" },
				{
					id: "file-1",
					kind: "file",
					label: "brief.pdf",
					path: "/tmp/brief.pdf",
				},
			],
		});

		expect(timelineMessagePlainText(row)).toBe(
			"Hello\n\nbrief.pdf\n/tmp/brief.pdf",
		);
	});

	it("builds assistant reply copy from text parts only", () => {
		const row = messageRow({
			role: "assistant",
			parts: [
				{ id: "text-1", kind: "text", text: "Final answer" },
				{
					id: "tool-1",
					kind: "tool",
					label: "Tool call",
					text: "internal output",
				},
			],
		});

		expect(timelineAssistantReplyText(row)).toBe("Final answer");
	});

	it("labels assistant footer from status", () => {
		expect(assistantFooterLabel(messageRow({ status: "streaming" }))).toBe(
			"Working",
		);
		expect(assistantFooterLabel(messageRow({ status: "failed" }))).toBe(
			"Failed",
		);
	});

	it("labels assistant footer with live and terminal duration", () => {
		const startedAt = "2026-06-24T00:00:00.000Z";
		const completedAt = "2026-06-24T00:01:08.000Z";
		const now = Date.parse("2026-06-24T00:00:12.000Z");

		expect(
			assistantFooterLabel(
				messageRow({
					role: "assistant",
					status: "streaming",
					startedAt,
				}),
				now,
			),
		).toBe("Working · 12s");
		expect(
			assistantFooterLabel(
				messageRow({
					role: "assistant",
					status: "completed",
					startedAt,
					completedAt,
				}),
			),
		).toBe("Completed in 1m 8s");
		expect(
			assistantFooterLabel(
				messageRow({
					role: "assistant",
					status: "failed",
					startedAt,
					completedAt,
				}),
			),
		).toBe("Failed after 1m 8s");
	});

	it("formats longer durations", () => {
		expect(
			formatDurationBetween(
				"2026-06-24T00:00:00.000Z",
				"2026-06-24T02:05:00.000Z",
			),
		).toBe("2h 5m");
	});
});

function messageRow(
	overrides: Partial<Extract<ConversationTimelineRow, { kind: "message" }>> = {},
): Extract<ConversationTimelineRow, { kind: "message" }> {
	return {
		id: "message-1",
		kind: "message",
		semanticKind: "user_message",
		anchorId: "message-1",
		signature: "message-1",
		sizeHint: "message",
		role: "user",
		status: "completed",
		text: "Hello",
		time: "2026-06-24T00:00:00.000Z",
		parts: [],
		...overrides,
	};
}
