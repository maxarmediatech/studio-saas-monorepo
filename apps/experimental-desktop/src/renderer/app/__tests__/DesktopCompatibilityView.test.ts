import { describe, expect, it } from "vitest";
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
