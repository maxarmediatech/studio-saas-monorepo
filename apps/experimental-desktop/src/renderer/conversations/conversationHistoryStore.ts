import { useEffect, useSyncExternalStore } from "react";
import type { ConversationSummary } from "../../preload/types";
import { listConversationSummaries } from "./conversationTransport";

type Listener = () => void;

export type ConversationHistoryState = {
	conversations: ConversationSummary[];
	status: "idle" | "loading" | "ready" | "error";
	error?: string;
};

export type ConversationHistoryTransport = {
	listConversationSummaries: () => Promise<ConversationSummary[]>;
};

export function createConversationHistoryStore(
	transport: ConversationHistoryTransport = { listConversationSummaries },
) {
	let state: ConversationHistoryState = {
		conversations: [],
		status: "idle",
	};
	let refreshId = 0;
	const listeners = new Set<Listener>();

	function getSnapshot() {
		return state;
	}

	function subscribe(listener: Listener) {
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	}

	async function refresh() {
		const currentRefreshId = ++refreshId;
		setState({ ...state, status: "loading", error: undefined });
		try {
			const conversations = await transport.listConversationSummaries();
			if (currentRefreshId !== refreshId) {
				return;
			}
			setState({ conversations, status: "ready" });
		} catch (error) {
			if (currentRefreshId !== refreshId) {
				return;
			}
			setState({
				...state,
				status: "error",
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	function setState(nextState: ConversationHistoryState) {
		state = nextState;
		for (const listener of listeners) {
			listener();
		}
	}

	return {
		getSnapshot,
		subscribe,
		refresh,
	};
}

export const conversationHistoryStore = createConversationHistoryStore();

export function useConversationHistoryStore() {
	const state = useSyncExternalStore(
		conversationHistoryStore.subscribe,
		conversationHistoryStore.getSnapshot,
		conversationHistoryStore.getSnapshot,
	);

	useEffect(() => {
		if (state.status === "idle") {
			void conversationHistoryStore.refresh();
		}
	}, [state.status]);

	return {
		...state,
		refreshConversations: conversationHistoryStore.refresh,
	};
}
