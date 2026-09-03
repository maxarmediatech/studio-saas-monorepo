import { describe, expect, it } from "vitest";
import {
	buildQuotationPdfUrl,
	isQuotationPresentationConflict,
	isQuotationTemplateAvailable,
	requestedQuotationPresentation,
	requestedQuotationRevision,
} from "./quotation-pdf-route";

describe("quotation PDF preview route", () => {
	it("uses the revision query parameter emitted by the preview", () => {
		expect(
			requestedQuotationRevision(new URLSearchParams("revision=7"), 8),
		).toBe(7);
		expect(
			requestedQuotationRevision(
				new URLSearchParams("documentRevision=7"),
				8,
			),
		).toBe(8);
	});

	it("builds an explicit immutable presentation identity", () => {
		const url = buildQuotationPdfUrl("quote/1", {
			documentRevision: 7,
			templateId: "neutral",
			templateVersion: 1,
			selectionVersion: 3,
		});
		expect(url).toBe(
			"/api/studio/quotations/quote%2F1/pdf?revision=7&templateId=neutral&templateVersion=1&selectionVersion=3",
		);
		expect(
			requestedQuotationPresentation(
				new URL(url, "https://stuwiz.test").searchParams,
			),
		).toEqual({
			provided: true,
			identity: {
				templateId: "neutral",
				templateVersion: 1,
				selectionVersion: 3,
			},
		});
	});

	it("explicitly represents the unmaterialized classic selection", () => {
		const url = buildQuotationPdfUrl("quote-1", {
			documentRevision: 1,
			templateId: "classic",
			templateVersion: 1,
			selectionVersion: null,
		});
		expect(url).toContain("selectionVersion=implicit");
		expect(
			requestedQuotationPresentation(
				new URL(url, "https://stuwiz.test").searchParams,
			).identity?.selectionVersion,
		).toBeNull();
	});

	it("matches catalog availability by the complete immutable identity", () => {
		const catalog = [{ templateId: "neutral", templateVersion: 1 }];
		expect(
			isQuotationTemplateAvailable(catalog, {
				templateId: "neutral",
				templateVersion: 1,
			}),
		).toBe(true);
		expect(
			isQuotationTemplateAvailable(catalog, {
				templateId: "neutral",
				templateVersion: 2,
			}),
		).toBe(false);
	});

	it("recognizes optimistic-concurrency conflicts", () => {
		expect(isQuotationPresentationConflict({ code: "CONFLICT" })).toBe(
			true,
		);
		expect(isQuotationPresentationConflict({ status: 409 })).toBe(true);
		expect(isQuotationPresentationConflict(new Error("failed"))).toBe(
			false,
		);
	});

	it("rejects partial and invalid presentation identities", () => {
		expect(
			requestedQuotationPresentation(
				new URLSearchParams("templateId=neutral&templateVersion=1"),
			),
		).toEqual({ provided: true, identity: null });
		expect(
			requestedQuotationPresentation(
				new URLSearchParams(
					"templateId=neutral&templateVersion=0&selectionVersion=1",
				),
			),
		).toEqual({ provided: true, identity: null });
	});
});
