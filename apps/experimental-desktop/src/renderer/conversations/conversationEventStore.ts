import type { ConversationEvent } from "../../preload/types";
import { subscribeConversationEvents } from "./conversationTransport";

type Unsubscribe = () => void;
type MaybePromise<T> = T | Promise<T>;

export type ConversationEventSubscriptionTransport = {
	subscribeConversationEvents: (
		conversationId: string,
		listener: (event: ConversationEvent) => void,
	) => MaybePromise<Unsubscribe>;
};

export type ConversationEventStore = ReturnType<
	typeof createConversationEventStore
>;

export function createConversationEventStore(
	transport: ConversationEventSubscriptionTransport = {
		subscribeConversationEvents,
	},
) {
	let activeSubscriptionId = 0;
	let unsubscribe: Unsubscribe | undefined;
	const seenEventIds = new Set<string>();

	async function subscribe(
		conversationId: string,
		listener: (event: ConversationEvent) => void,
	) {
		const subscriptionId = resetSubscription();
		const nextUnsubscribe = await transport.subscribeConversationEvents(
			conversationId,
			(event) => {
				if (subscriptionId !== activeSubscriptionId) {
					return;
				}
				if (seenEventIds.has(event.id)) {
					return;
				}
				seenEventIds.add(event.id);
				listener(event);
			},
		);
		if (subscriptionId !== activeSubscriptionId) {
			nextUnsubscribe();
			return;
		}
		unsubscribe = nextUnsubscribe;
	}

	function clear() {
		resetSubscription();
	}

	function resetSubscription() {
		activeSubscriptionId += 1;
		unsubscribe?.();
		unsubscribe = undefined;
		seenEventIds.clear();
		return activeSubscriptionId;
	}

	return {
		subscribe,
		clear,
	};
}
