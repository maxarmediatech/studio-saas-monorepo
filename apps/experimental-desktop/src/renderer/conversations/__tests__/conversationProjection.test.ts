import { describe, expect, it } from "vitest";
import type {
	ConversationDetail,
	ConversationEvent,
} from "../../../preload/types";
import {
	applyConversationEventProjection,
	createEmptyConversationProjection,
	projectConversationDetail,
	summarizeConversationEvent,
} from "../conversationProjection";

describe("conversationProjection", () => {
	it("projects conversation detail into transcript, pending requests, and status", () => {
		const projection = projectConversationDetail({
			...baseConversation,
			status: "waiting_approval",
			runtimeMode: "workspace-write",
			messages: [
				{
					id: "message-user",
					conversationId: "conversation-1",
					ordinal: 0,
					role: "user",
					status: "completed",
					text: "hello",
					createdAt: "2026-06-24T00:00:00.000Z",
					updatedAt: "2026-06-24T00:00:00.000Z",
				},
				{
					id: "message-assistant",
					conversationId: "conversation-1",
					turnId: "turn-1",
					ordinal: 1,
					role: "assistant",
					status: "streaming",
					text: "hi",
					createdAt: "2026-06-24T00:00:01.000Z",
					updatedAt: "2026-06-24T00:00:01.000Z",
				},
			],
			pendingApprovals: [
				{
					id: "approval-1",
					conversationId: "conversation-1",
					turnId: "turn-1",
					providerRequestId: "request-1",
					providerItemId: "item-1",
					kind: "command",
					status: "pending",
					request: { command: "npm test" },
					createdAt: "2026-06-24T00:00:02.000Z",
				},
			],
		});

		expect(projection.status).toBe("waiting_approval · Workspace Edit");
		expect(projection.isTurnActive).toBe(true);
		expect(projection.transcript).toEqual([
			expect.objectContaining({ id: "message-user", type: "user" }),
			expect.objectContaining({
				id: "message-assistant",
				type: "assistant",
				status: "streaming",
			}),
			expect.objectContaining({
				id: "approval-1",
				type: "approval",
				requestId: "request-1",
			}),
		]);
		expect(projection.pendingRequests).toEqual([
			expect.objectContaining({
				id: "approval-1",
				type: "request.pending",
				data: expect.objectContaining({
					requestId: "request-1",
					itemId: "item-1",
				}),
			}),
		]);
	});

	it("applies message created without duplicating existing user messages", () => {
		const state = createEmptyConversationProjection();
		const event = messageCreatedEvent({ messageId: "message-user" });
		const first = applyConversationEventProjection(state, event);
		const second = applyConversationEventProjection(first.state, event);

		expect(first.shouldRefreshConversations).toBe(true);
		expect(second.state.transcript).toHaveLength(1);
		expect(second.state.status).toBe("Running...");
		expect(second.state.isTurnActive).toBe(true);
	});

	it("appends assistant deltas to the active streaming assistant message", () => {
		const first = applyConversationEventProjection(
			createEmptyConversationProjection(),
			assistantDeltaEvent({ id: "event-1", text: "hel" }),
		);
		const second = applyConversationEventProjection(
			first.state,
			assistantDeltaEvent({ id: "event-2", text: "lo" }),
		);

		expect(second.shouldRefreshConversations).toBe(false);
		expect(second.state.transcript).toEqual([
			expect.objectContaining({
				id: "assistant-event-1",
				type: "assistant",
				text: "hello",
				status: "streaming",
			}),
		]);
		expect(second.state.status).toBe("Streaming...");
	});

	it("marks assistant completion and requests conversation refresh", () => {
		const state = {
			...createEmptyConversationProjection(),
			transcript: [
				{
					id: "assistant-1",
					type: "assistant" as const,
					text: "done",
					status: "streaming" as const,
					turnId: "turn-1",
					time: "2026-06-24T00:00:01.000Z",
				},
			],
			isTurnActive: true,
		};

		const result = applyConversationEventProjection(state, {
			id: "event-complete",
			type: "assistant.completed",
			time: "2026-06-24T00:00:02.000Z",
			data: { turnId: "turn-1", raw: {} },
		});

		expect(result.shouldRefreshConversations).toBe(true);
		expect(result.state.transcript[0]).toEqual(
			expect.objectContaining({ status: "done" }),
		);
		expect(result.state.isTurnActive).toBe(false);
		expect(result.state.status).toBe("Completed");
	});

	it("projects failed and interrupted terminal events", () => {
		const activeState = {
			...createEmptyConversationProjection(),
			transcript: [
				{
					id: "assistant-1",
					type: "assistant" as const,
					text: "working",
					status: "streaming" as const,
					turnId: "turn-1",
					time: "2026-06-24T00:00:01.000Z",
				},
			],
			pendingRequests: [pendingRequest("request-1")],
			isTurnActive: true,
		};

		const failed = applyConversationEventProjection(activeState, {
			id: "event-failed",
			type: "message.failed",
			time: "2026-06-24T00:00:02.000Z",
			data: { error: "boom", turnId: "turn-1" },
		});
		const interrupted = applyConversationEventProjection(activeState, {
			id: "event-interrupted",
			type: "turn.interrupted",
			time: "2026-06-24T00:00:03.000Z",
			data: { turnId: "turn-1", message: "Interrupted" },
		});

		expect(failed.shouldRefreshConversations).toBe(true);
		expect(failed.state.pendingRequests).toEqual([]);
		expect(failed.state.transcript.at(-1)).toEqual(
			expect.objectContaining({ type: "system", text: "boom" }),
		);
		expect(interrupted.shouldRefreshConversations).toBe(true);
		expect(interrupted.state.pendingRequests).toEqual([]);
		expect(interrupted.state.transcript[0]).toEqual(
			expect.objectContaining({ status: "interrupted" }),
		);
	});

	it("projects approval pending and resolved events", () => {
		const pending = applyConversationEventProjection(
			createEmptyConversationProjection(),
			{
				id: "event-request",
				type: "request.pending",
				time: "2026-06-24T00:00:02.000Z",
				data: {
					requestId: "request-1",
					approvalId: "approval-1",
					method: "command",
					requestKind: "command",
					turnId: "turn-1",
					itemId: "item-1",
					raw: {},
				},
			},
		);
		const resolved = applyConversationEventProjection(pending.state, {
			id: "event-resolved",
			type: "request.resolved",
			time: "2026-06-24T00:00:03.000Z",
			data: { requestId: "request-1", response: {} },
		});

		expect(pending.state.pendingRequests).toHaveLength(1);
		expect(pending.state.transcript).toEqual([
			expect.objectContaining({
				id: "approval-1",
				type: "approval",
				requestId: "request-1",
			}),
		]);
		expect(pending.state.status).toBe("Waiting for command approval");
		expect(resolved.state.pendingRequests).toEqual([]);
		expect(resolved.state.status).toBe("Running...");
	});

	it("projects compaction and event log summaries", () => {
		const result = applyConversationEventProjection(
			createEmptyConversationProjection(),
			{
				id: "event-compacted",
				type: "session.compacted",
				time: "2026-06-24T00:00:02.000Z",
				data: {
					summaryId: "summary-1",
					messageId: "message-summary",
					reason: "auto",
					tokensBefore: 12345,
				},
			},
		);

		expect(result.shouldRefreshConversations).toBe(true);
		expect(result.state.transcript).toEqual([
			expect.objectContaining({
				type: "system",
				text: "Session compacted · 12,345 tokens summarized",
			}),
		]);
		expect(summarizeConversationEvent(messageCreatedEvent())).toBe("hello");
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

function messageCreatedEvent(input?: {
	messageId?: string;
}): ConversationEvent {
	return {
		id: "event-user",
		type: "message.created",
		time: "2026-06-24T00:00:00.000Z",
		data: {
			text: "hello",
			messageId: input?.messageId,
			turnId: "turn-1",
		},
	};
}

function assistantDeltaEvent(input: {
	id: string;
	text: string;
}): ConversationEvent {
	return {
		id: input.id,
		type: "assistant.delta",
		time: "2026-06-24T00:00:01.000Z",
		data: { text: input.text, turnId: "turn-1", raw: {} },
	};
}

function pendingRequest(requestId: string) {
	return {
		id: "approval-1",
		type: "request.pending" as const,
		time: "2026-06-24T00:00:02.000Z",
		data: {
			requestId,
			approvalId: "approval-1",
			method: "command",
			requestKind: "command" as const,
			turnId: "turn-1",
			raw: {},
		},
	};
}
