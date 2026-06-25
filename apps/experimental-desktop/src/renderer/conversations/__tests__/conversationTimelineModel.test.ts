import { describe, expect, it } from "vitest";
import type { ConversationDetail } from "../../../preload/types";
import type { PendingRequest, TranscriptItem } from "../../app/types";
import {
	createConversationTimelineRowStabilizer,
	projectConversationTimeline,
} from "../conversationTimelineModel";

describe("conversationTimelineModel", () => {
	it("projects persisted message parts into timeline parts", () => {
		const model = projectConversationTimeline({
			conversation: {
				...baseConversation,
				messages: [
					{
						id: "message-user",
						conversationId: "conversation-1",
						ordinal: 0,
						role: "user",
						status: "completed",
						text: "serialized request",
						createdAt: "2026-06-24T00:00:00.000Z",
						updatedAt: "2026-06-24T00:00:00.000Z",
						parts: [
							{
								id: "message-user:text",
								conversationId: "conversation-1",
								messageId: "message-user",
								ordinal: 0,
								type: "text",
								text: "serialized request",
								json: {
									composerPayload: {
										parts: [
											{
												type: "context_file",
												label: "README.md",
												path: "/repo/README.md",
											},
											{
												type: "attachment_image",
												name: "screen.png",
												path: "/tmp/screen.png",
												mimeType: "image/png",
											},
										],
									},
								},
								createdAt: "2026-06-24T00:00:00.000Z",
								updatedAt: "2026-06-24T00:00:00.000Z",
							},
						],
					},
				],
			},
			transcript: [userTranscript],
			pendingRequests: [],
		});

		expect(model.rows).toEqual([
			expect.objectContaining({
				id: "message-user",
				kind: "message",
				semanticKind: "user_message",
				anchorId: "message-user",
				sizeHint: "media",
				signature: expect.any(String),
				parts: [
					expect.objectContaining({
						kind: "context",
						label: "README.md",
						path: "/repo/README.md",
					}),
					expect.objectContaining({
						kind: "image",
						label: "screen.png",
						path: "/tmp/screen.png",
					}),
					expect.objectContaining({
						kind: "text",
						text: "serialized request",
					}),
				],
			}),
			expect.objectContaining({
				id: "message-user:media-grid",
				kind: "mediaGrid",
				semanticKind: "media_grid",
				title: "1 image",
				items: [
					expect.objectContaining({
						label: "screen.png",
						path: "/tmp/screen.png",
					}),
				],
			}),
		]);
	});

	it("renders approval transcript rows as request rows with pending state", () => {
		const model = projectConversationTimeline({
			transcript: [
				{
					id: "approval-1",
					type: "approval",
					requestId: "request-1",
					requestKind: "command",
					time: "2026-06-24T00:00:01.000Z",
				},
			],
			pendingRequests: [pendingRequest("request-1")],
		});

		expect(model.rows).toEqual([
			expect.objectContaining({
				kind: "request",
				requestId: "request-1",
				pending: true,
				raw: { command: "npm test" },
			}),
		]);
		expect(model.pendingRequests).toHaveLength(1);
		expect(model.rows[0]).toEqual(
			expect.objectContaining({
				semanticKind: "approval",
				anchorId: "approval-1",
				sizeHint: "compact",
				signature: expect.any(String),
			}),
		);
	});

	it("projects system transcript rows into event rows", () => {
		const model = projectConversationTimeline({
			transcript: [
				{
					id: "event-1",
					type: "system",
					text: "Session compacted · 12,345 tokens summarized",
					time: "2026-06-24T00:00:02.000Z",
				},
			],
			pendingRequests: [],
		});

		expect(model.rows).toEqual([
			expect.objectContaining({
				kind: "event",
				semanticKind: "compaction",
				tone: "compaction",
				title: "Compaction",
			}),
		]);
	});

	it("titles usage-limit failures explicitly", () => {
		const model = projectConversationTimeline({
			transcript: [
				{
					id: "event-usage-limit",
					type: "system",
					text: "You've hit your usage limit. Try again at 8:04 PM.",
					time: "2026-06-24T00:00:02.000Z",
				},
			],
			pendingRequests: [],
		});

		expect(model.rows).toEqual([
			expect.objectContaining({
				kind: "event",
				tone: "error",
				title: "Usage limit reached",
			}),
		]);
	});

	it("stabilizes unchanged rows by signature", () => {
		const stabilize = createConversationTimelineRowStabilizer();
		const first = projectConversationTimeline({
			transcript: [userTranscript],
			pendingRequests: [],
		}).rows;
		const second = projectConversationTimeline({
			transcript: [userTranscript],
			pendingRequests: [],
		}).rows;

		const stableFirst = stabilize(first);
		const stableSecond = stabilize(second);

		expect(stableSecond[0]).toBe(stableFirst[0]);
	});

	it("replaces changed rows when signature changes", () => {
		const stabilize = createConversationTimelineRowStabilizer();
		const first = projectConversationTimeline({
			transcript: [userTranscript],
			pendingRequests: [],
		}).rows;
		const changedTranscript: TranscriptItem = {
			id: "message-user",
			type: "user",
			text: "changed request",
			time: "2026-06-24T00:00:00.000Z",
		};
		const second = projectConversationTimeline({
			transcript: [changedTranscript],
			pendingRequests: [],
		}).rows;

		const stableFirst = stabilize(first);
		const stableSecond = stabilize(second);

		expect(stableSecond[0]).not.toBe(stableFirst[0]);
	});

	it("does not render empty assistant placeholders", () => {
		const model = projectConversationTimeline({
			transcript: [
				{
					id: "assistant-1",
					type: "assistant",
					text: "",
					status: "streaming",
					turnId: "turn-1",
					time: "2026-06-24T00:00:02.000Z",
				},
			],
			pendingRequests: [],
		});

		expect(model.rows).toEqual([]);
	});
});

const baseConversation: ConversationDetail = {
	id: "conversation-1",
	title: "Test",
	cwd: "/tmp",
	runtimeMode: "read-only",
	status: "idle",
	createdAt: "2026-06-24T00:00:00.000Z",
	updatedAt: "2026-06-24T00:00:00.000Z",
	messages: [],
	pendingApprovals: [],
};

const userTranscript: TranscriptItem = {
	id: "message-user",
	type: "user",
	text: "serialized request",
	time: "2026-06-24T00:00:00.000Z",
};

function pendingRequest(requestId: string): PendingRequest {
	return {
		id: "approval-1",
		type: "request.pending",
		time: "2026-06-24T00:00:01.000Z",
		data: {
			requestId,
			approvalId: "approval-1",
			method: "command",
			requestKind: "command",
			turnId: "turn-1",
			raw: { command: "npm test" },
		},
	};
}
