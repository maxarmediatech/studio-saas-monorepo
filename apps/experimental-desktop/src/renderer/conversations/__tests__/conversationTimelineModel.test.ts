import { describe, expect, it } from "vitest";
import type { ConversationDetail } from "../../../preload/types";
import type { PendingRequest, TranscriptItem } from "../../app/types";
import { projectConversationTimeline } from "../conversationTimelineModel";

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
				tone: "compaction",
				title: "Compaction",
			}),
		]);
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
