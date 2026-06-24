import { describe, expect, it } from "vitest";
import type { ConversationEvent } from "../../../preload/types";
import { createConversationEventStore } from "../conversationEventStore";

describe("conversationEventStore", () => {
	it("subscribes by conversation id and suppresses duplicate event ids", async () => {
		const transport = createFakeTransport();
		const store = createConversationEventStore(transport);
		const events: ConversationEvent[] = [];

		await store.subscribe("conversation-1", (event) => {
			events.push(event);
		});
		transport.emit(messageCreatedEvent("event-1"));
		transport.emit(messageCreatedEvent("event-1"));
		transport.emit(messageCreatedEvent("event-2"));

		expect(transport.subscriptions).toEqual(["conversation-1"]);
		expect(events.map((event) => event.id)).toEqual(["event-1", "event-2"]);
	});

	it("cleans up the previous subscription when the active conversation changes", async () => {
		const transport = createFakeTransport();
		const store = createConversationEventStore(transport);
		const events: string[] = [];

		await store.subscribe("conversation-1", (event) => {
			events.push(event.id);
		});
		await store.subscribe("conversation-2", (event) => {
			events.push(event.id);
		});
		transport.emit(messageCreatedEvent("event-1"));

		expect(transport.unsubscribed).toBe(1);
		expect(transport.subscriptions).toEqual([
			"conversation-1",
			"conversation-2",
		]);
		expect(events).toEqual(["event-1"]);
	});

	it("unsubscribes a stale async subscription that resolves after clear", async () => {
		let listener: ((event: ConversationEvent) => void) | undefined;
		let resolveSubscribe: ((unsubscribe: () => void) => void) | undefined;
		let unsubscribeCount = 0;
		const store = createConversationEventStore({
			subscribeConversationEvents: (_conversationId, nextListener) => {
				listener = nextListener;
				return new Promise<() => void>((resolve) => {
					resolveSubscribe = resolve;
				});
			},
		});
		const events: string[] = [];

		const pendingSubscribe = store.subscribe("conversation-1", (event) => {
			events.push(event.id);
		});
		store.clear();
		resolveSubscribe?.(() => {
			unsubscribeCount += 1;
		});
		await pendingSubscribe;
		listener?.(messageCreatedEvent("event-1"));

		expect(unsubscribeCount).toBe(1);
		expect(events).toEqual([]);
	});
});

function createFakeTransport() {
	let listener: ((event: ConversationEvent) => void) | undefined;
	const subscriptions: string[] = [];
	let unsubscribed = 0;
	return {
		get subscriptions() {
			return subscriptions;
		},
		get unsubscribed() {
			return unsubscribed;
		},
		subscribeConversationEvents(
			conversationId: string,
			nextListener: (event: ConversationEvent) => void,
		) {
			subscriptions.push(conversationId);
			listener = nextListener;
			return () => {
				unsubscribed += 1;
				listener = undefined;
			};
		},
		emit(event: ConversationEvent) {
			listener?.(event);
		},
	};
}

function messageCreatedEvent(id: string): ConversationEvent {
	return {
		id,
		type: "message.created",
		time: "2026-06-24T00:00:00.000Z",
		data: { text: "hello", messageId: `message-${id}` },
	};
}
