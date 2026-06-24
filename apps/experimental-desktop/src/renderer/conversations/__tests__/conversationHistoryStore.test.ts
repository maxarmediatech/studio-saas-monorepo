import { describe, expect, it } from "vitest";
import type { ConversationSummary } from "../../../preload/types";
import { createConversationHistoryStore } from "../conversationHistoryStore";

describe("conversationHistoryStore", () => {
	it("loads conversation summaries and notifies subscribers", async () => {
		const store = createConversationHistoryStore({
			listConversationSummaries: async () => [
				conversationSummary("conversation-1"),
			],
		});
		let notifications = 0;
		const unsubscribe = store.subscribe(() => {
			notifications += 1;
		});

		await store.refresh();

		expect(notifications).toBe(2);
		expect(store.getSnapshot()).toEqual({
			conversations: [conversationSummary("conversation-1")],
			status: "ready",
		});
		unsubscribe();
	});

	it("keeps the previous list and exposes refresh errors", async () => {
		let callCount = 0;
		const store = createConversationHistoryStore({
			listConversationSummaries: async () => {
				callCount += 1;
				if (callCount === 1) {
					return [conversationSummary("conversation-1")];
				}
				throw new Error("history unavailable");
			},
		});
		await store.refresh();
		await store.refresh();

		expect(store.getSnapshot()).toEqual({
			conversations: [conversationSummary("conversation-1")],
			status: "error",
			error: "history unavailable",
		});
	});

	it("ignores stale refresh results that resolve after a newer refresh", async () => {
		let resolveSlow:
			| ((conversations: ConversationSummary[]) => void)
			| undefined;
		let callCount = 0;
		const store = createConversationHistoryStore({
			listConversationSummaries: () => {
				callCount += 1;
				if (callCount === 1) {
					return new Promise<ConversationSummary[]>((resolve) => {
						resolveSlow = resolve;
					});
				}
				return Promise.resolve([
					conversationSummary("conversation-new"),
				]);
			},
		});

		const slowRefresh = store.refresh();
		await store.refresh();
		resolveSlow?.([conversationSummary("conversation-old")]);
		await slowRefresh;

		expect(store.getSnapshot()).toEqual({
			conversations: [conversationSummary("conversation-new")],
			status: "ready",
		});
	});
});

function conversationSummary(id: string): ConversationSummary {
	return {
		id,
		title: id,
		cwd: "/tmp",
		runtimeMode: "read-only",
		status: "idle",
		createdAt: "2026-06-24T00:00:00.000Z",
		updatedAt: "2026-06-24T00:00:00.000Z",
	};
}
