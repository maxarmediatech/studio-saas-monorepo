import type { ConversationTimelineModel } from "../conversations/conversationTimelineModel";

export function shouldShowConversationSurface(model: ConversationTimelineModel) {
	return model.rows.length > 0 || model.pendingRequests.length > 0;
}
