export function shouldNavigatePromotedDraft(input: {
	routeKind: "draft" | "conversation" | "capture";
	routeDraftId?: string;
	conversationId?: string;
	pendingDraftId?: string;
}) {
	return (
		input.routeKind === "draft" &&
		!!input.routeDraftId &&
		!!input.conversationId &&
		input.pendingDraftId === input.routeDraftId
	);
}
