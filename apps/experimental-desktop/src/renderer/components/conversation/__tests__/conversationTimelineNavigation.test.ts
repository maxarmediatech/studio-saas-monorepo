import { describe, expect, it } from "vitest";
import type { ConversationTimelineRow } from "../../../conversations/conversationTimelineModel";
import {
	buildTimelineLandmarks,
	buildTimelineSearchMatches,
	timelineRowSearchText,
} from "../conversationTimelineNavigation";

describe("conversationTimelineNavigation", () => {
	it("searches across message text and rich parts", () => {
		const assistantRow = messageRow("assistant-1", "assistant", "Done") as Extract<
			ConversationTimelineRow,
			{ kind: "message" }
		>;
		const rows: ConversationTimelineRow[] = [
			messageRow("user-1", "user", "Please inspect invoices"),
			{
				...assistantRow,
				parts: [{ id: "tool-1", kind: "tool", label: "read_file", text: "billing.ts" }],
			},
		];

		expect(buildTimelineSearchMatches(rows, "invoice")).toEqual([
			expect.objectContaining({ rowId: "user-1", index: 0 }),
		]);
		expect(buildTimelineSearchMatches(rows, "billing.ts")).toEqual([
			expect.objectContaining({ rowId: "assistant-1", index: 1 }),
		]);
		expect(buildTimelineSearchMatches(rows, "read_file")).toEqual([
			expect.objectContaining({ rowId: "assistant-1", index: 1 }),
		]);
	});

	it("searches visible reference labels and metadata", () => {
		const referenceRow = messageRow("assistant-refs", "assistant", "References") as Extract<
			ConversationTimelineRow,
			{ kind: "message" }
		>;
		const rows: ConversationTimelineRow[] = [{
			...referenceRow,
			parts: [
				{ id: "file-1", kind: "file", label: "Invoice model", path: "src/billing/invoice.ts" },
				{ id: "image-1", kind: "image", label: "Reference frame", path: "assets/shot.png", mimeType: "image/png" },
				{ id: "context-1", kind: "context", label: "Workspace notes", path: "docs/context.md", contextType: "workspace" },
			],
		}];

		expect(buildTimelineSearchMatches(rows, "Invoice model")).toEqual([
			expect.objectContaining({ rowId: "assistant-refs" }),
		]);
		expect(buildTimelineSearchMatches(rows, "image/png")).toEqual([
			expect.objectContaining({ rowId: "assistant-refs" }),
		]);
		expect(buildTimelineSearchMatches(rows, "workspace")).toEqual([
			expect.objectContaining({ rowId: "assistant-refs" }),
		]);
	});

	it("builds sampled landmarks from user and operational rows", () => {
		const rows: ConversationTimelineRow[] = [
			messageRow("user-1", "user", "first"),
			messageRow("assistant-1", "assistant", "answer"),
			{
				id: "event-1",
				kind: "event",
				semanticKind: "error",
				anchorId: "event-1",
				signature: "event-1",
				sizeHint: "compact",
				tone: "error",
				title: "Failed",
			},
			messageRow("user-2", "user", "second"),
		];

		const landmarks = buildTimelineLandmarks(rows, 10);
		expect(landmarks.map((item) => item.rowId)).toEqual([
			"user-1",
			"event-1",
			"user-2",
		]);
	});

	it("samples long landmark rails while keeping first and last", () => {
		const rows = Array.from({ length: 200 }, (_, index) =>
			messageRow(`user-${index}`, "user", `message ${index}`),
		);
		const landmarks = buildTimelineLandmarks(rows, 20);

		expect(landmarks).toHaveLength(20);
		expect(landmarks.at(0)?.rowId).toBe("user-0");
		expect(landmarks.at(-1)?.rowId).toBe("user-199");
	});

	it("produces searchable text for media rows", () => {
		const text = timelineRowSearchText({
			id: "media-1",
			kind: "mediaGrid",
			semanticKind: "system_notice",
			anchorId: "media-1",
			signature: "media-1",
			sizeHint: "media",
			title: "Attachments",
			items: [{ id: "image-1", label: "Reference frame", path: "/shot/a.png" }],
		});

		expect(text).toContain("Reference frame");
		expect(text).toContain("/shot/a.png");
	});
});

function messageRow(
	id: string,
	role: "user" | "assistant" | "system",
	text: string,
): ConversationTimelineRow {
	return {
		id,
		kind: "message",
		semanticKind: role === "user" ? "user_message" : "assistant_turn",
		anchorId: id,
		signature: id,
		sizeHint: role === "assistant" ? "assistant" : "message",
		role,
		status: "completed",
		text,
		time: "2026-06-25T00:00:00.000Z",
		parts: [{ id: `${id}:text`, kind: "text", text }],
	};
}
