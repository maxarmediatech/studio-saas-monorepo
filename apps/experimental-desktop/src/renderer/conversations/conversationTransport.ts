import type {
	ConversationDetail,
	ConversationEvent,
} from "../../preload/types";

export function loadConversationDetail(conversationId: string) {
	return window.experimentalDesktop.getConversation(conversationId);
}

export function subscribeConversationEvents(
	conversationId: string,
	listener: (event: ConversationEvent) => void,
) {
	return window.experimentalDesktop.subscribeConversationEvents(
		conversationId,
		listener,
	);
}

export type ConversationDetailTransport = {
	loadConversationDetail: typeof loadConversationDetail;
	subscribeConversationEvents: typeof subscribeConversationEvents;
};

export type LoadedConversationDetail = NonNullable<ConversationDetail>;
