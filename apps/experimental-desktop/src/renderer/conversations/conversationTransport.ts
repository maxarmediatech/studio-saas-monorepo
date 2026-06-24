import type {
	ConversationDetail,
	ConversationEvent,
	ConversationSummary,
} from "../../preload/types";

export function listConversationSummaries() {
	return window.experimentalDesktop.listConversations();
}

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
	listConversationSummaries: typeof listConversationSummaries;
	loadConversationDetail: typeof loadConversationDetail;
	subscribeConversationEvents: typeof subscribeConversationEvents;
};

export type LoadedConversationDetail = NonNullable<ConversationDetail>;
export type LoadedConversationSummary = ConversationSummary;
