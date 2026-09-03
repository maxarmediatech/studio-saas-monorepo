import { describe, expect, it } from "vitest";
import {
	completeQuotationPreviewLoad,
	listQuotationPreviewResources,
	promoteQuotationPreviewResource,
	syncQuotationPreviewTarget,
} from "./quotation-preview-state";

describe("quotation preview frame state", () => {
	it("keeps the prior iframe visible until the replacement loads", () => {
		const preparing = syncQuotationPreviewTarget(
			{ displayedUrl: "/classic.pdf", loadingUrl: null },
			"/neutral.pdf",
		);
		expect(preparing).toEqual({
			displayedUrl: "/classic.pdf",
			loadingUrl: "/neutral.pdf",
		});
		expect(
			completeQuotationPreviewLoad(
				preparing,
				"/neutral.pdf",
				"/neutral.pdf",
			),
		).toEqual({ displayedUrl: "/neutral.pdf", loadingUrl: null });
	});

	it("promotes the exact prepared iframe resource without changing its key", () => {
		const prepared = {
			canonicalUrl: "/neutral.pdf",
			objectUrl: "blob:neutral",
		};
		const before = {
			displayed: {
				canonicalUrl: "/classic.pdf",
				objectUrl: "blob:classic",
			},
			prepared,
		};
		const promoted = promoteQuotationPreviewResource(
			before,
			prepared.objectUrl,
			prepared.canonicalUrl,
		);
		expect(
			listQuotationPreviewResources(before).map(
				(resource) => resource.objectUrl,
			),
		).toEqual(["blob:classic", "blob:neutral"]);
		expect(
			listQuotationPreviewResources(promoted).map(
				(resource) => resource.objectUrl,
			),
		).toEqual(["blob:neutral"]);
		expect(promoted.displayed).toBe(prepared);
		expect(
			promoteQuotationPreviewResource(
				before,
				prepared.objectUrl,
				"/newer.pdf",
			),
		).toBe(before);
	});

	it("ignores a stale iframe load after a newer selection", () => {
		const state = {
			displayedUrl: "/classic.pdf",
			loadingUrl: "/modern.pdf",
		};
		expect(
			completeQuotationPreviewLoad(state, "/neutral.pdf", "/modern.pdf"),
		).toBe(state);
	});
});
