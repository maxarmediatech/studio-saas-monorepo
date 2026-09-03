import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/database", () => ({
	and: vi.fn(),
	eq: vi.fn(),
	isNull: vi.fn(),
	quotationPresentations: {},
	quotes: {},
	db: {},
}));
vi.mock("../../activities/lib", () => ({
	trackActivityWithExecutor: vi.fn(),
}));

import {
	implicitClassicPresentation,
	listActiveQuotationTemplates,
} from "./quotation-presentation-service";

describe("quotation presentation catalog", () => {
	it("exposes the approved active immutable template versions", () => {
		expect(listActiveQuotationTemplates()).toEqual([
			expect.objectContaining({
				templateId: "classic",
				templateVersion: 2,
				label: "Classic v0",
				thumbnailPath: "/images/quotation-templates/classic-v0.png",
				copyProfileVersion: 1,
				composerVersion: 1,
			}),
		]);
	});

	it("represents an unmaterialized draft with an explicit null version", () => {
		expect(implicitClassicPresentation(7)).toEqual({
			documentRevision: 7,
			selectionVersion: null,
			templateId: "classic",
			templateVersion: 2,
		});
	});
});
