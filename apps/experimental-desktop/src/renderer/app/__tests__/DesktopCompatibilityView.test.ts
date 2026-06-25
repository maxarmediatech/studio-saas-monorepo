import { describe, expect, it } from "vitest";
import { shouldShowConversationSurface } from "../desktopConversationSurface";
import { shouldNavigatePromotedDraft } from "../desktopRoutePromotion";

describe("shouldNavigatePromotedDraft", () => {
	it("only navigates a draft route after that draft has started a send", () => {
		expect(
			shouldNavigatePromotedDraft({
				routeKind: "draft",
				routeDraftId: "draft-new",
				conversationId: "conversation-old",
				pendingDraftId: undefined,
			}),
		).toBe(false);
		expect(
			shouldNavigatePromotedDraft({
				routeKind: "draft",
				routeDraftId: "draft-new",
				conversationId: "conversation-old",
				pendingDraftId: "draft-other",
			}),
		).toBe(false);
		expect(
			shouldNavigatePromotedDraft({
				routeKind: "draft",
				routeDraftId: "draft-new",
				conversationId: "conversation-promoted",
				pendingDraftId: "draft-new",
			}),
		).toBe(true);
	});
});

describe("shouldShowConversationSurface", () => {
	it("keeps empty draft routes composer-first", () => {
		expect(
			shouldShowConversationSurface({
				rows: [],
				pendingRequests: [],
			}),
		).toBe(false);
		expect(
			shouldShowConversationSurface({
				rows: [
					{
						id: "message-1",
						kind: "message",
						semanticKind: "user_message",
						anchorId: "message-1",
						signature: "message-1:user",
						sizeHint: "message",
						role: "user",
						status: "completed",
						text: "hello",
						time: "2026-06-24T00:00:00.000Z",
						parts: [],
					},
				],
				pendingRequests: [],
			}),
		).toBe(true);
	});
});
