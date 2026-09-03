import { describe, expect, it } from "vitest";
import {
	buildQuotationPdfSnapshot,
	QUOTATION_PDF_PROVENANCE_INTEGRITY_ERROR,
} from "./quotation-pdf-snapshot";

const brandingSnapshot = {
	schemaVersion: 1 as const,
	organizationName: "Studio One",
	address: null,
	email: null,
	phone: null,
	taxIdentifier: null,
	timezone: "Asia/Kolkata",
	logoStorageKey: null,
	logoMimeType: null,
	logoSha256: null,
};

const legacyQuote = {
	id: "quote-1",
	version: 2,
	documentRevision: 4,
	pdfRenderIntentId: null,
	pdfRendererVersion: "quotation-pdf-v1",
	pdfStorageKey: "quotations/org/quote/v2/pdf.pdf",
	pdfSha256: "a".repeat(64),
	pdfRenderedAt: new Date("2026-08-04T08:00:00.000Z"),
	pdfPageCount: 3,
	pdfByteSize: 1234,
	brandingSnapshot,
};

const completedIntent = {
	id: "render-intent-1",
	quoteId: legacyQuote.id,
	quoteVersion: legacyQuote.version,
	documentRevision: legacyQuote.documentRevision,
	selectionVersion: 3,
	sourceFingerprint: "b".repeat(64),
	brandingFingerprint: "c".repeat(64),
	templateId: "classic",
	templateVersion: 1,
	copyProfileVersion: 1,
	composerVersion: 1,
	rendererVersion: legacyQuote.pdfRendererVersion,
	artifactStorageKey: legacyQuote.pdfStorageKey,
	artifactSha256: legacyQuote.pdfSha256,
	artifactRenderedAt: legacyQuote.pdfRenderedAt,
	artifactPageCount: legacyQuote.pdfPageCount,
	artifactByteSize: legacyQuote.pdfByteSize,
	status: "completed" as const,
};

const templateQuote = {
	...legacyQuote,
	pdfRenderIntentId: completedIntent.id,
	pdfProvenance: completedIntent,
};

function expectIntegrityFailure(
	input: Parameters<typeof buildQuotationPdfSnapshot>[0],
) {
	expect(() => buildQuotationPdfSnapshot(input)).toThrow(
		QUOTATION_PDF_PROVENANCE_INTEGRITY_ERROR,
	);
}

describe("buildQuotationPdfSnapshot", () => {
	it("keeps valid legacy evidence readable without provenance", () => {
		expect(buildQuotationPdfSnapshot(legacyQuote)).toEqual({
			rendererVersion: legacyQuote.pdfRendererVersion,
			storageKey: legacyQuote.pdfStorageKey,
			sha256: legacyQuote.pdfSha256,
			renderedAt: legacyQuote.pdfRenderedAt.toISOString(),
			pageCount: legacyQuote.pdfPageCount,
			byteSize: legacyQuote.pdfByteSize,
			branding: brandingSnapshot,
		});
	});

	it("never promotes a legacy quote from rogue passed-in provenance", () => {
		expect(
			buildQuotationPdfSnapshot({
				...legacyQuote,
				pdfProvenance: completedIntent,
			}),
		).not.toHaveProperty("provenance");
	});

	it("emits valid template evidence with exact completed provenance", () => {
		expect(buildQuotationPdfSnapshot(templateQuote)).toMatchObject({
			provenance: {
				renderIntentId: completedIntent.id,
				quotationId: templateQuote.id,
				quotationVersion: templateQuote.version,
				documentRevision: templateQuote.documentRevision,
				templateId: "classic",
				templateVersion: 1,
				artifactSha256: templateQuote.pdfSha256,
			},
		});
	});

	it("rejects template evidence whose completed intent is missing", () => {
		expectIntegrityFailure({ ...templateQuote, pdfProvenance: null });
	});

	it("rejects template evidence whose pointer names another intent", () => {
		expectIntegrityFailure({
			...templateQuote,
			pdfRenderIntentId: "render-intent-2",
		});
	});

	it.each([
		["quotation ID", { quoteId: "quote-2" }],
		["quotation version", { quoteVersion: 3 }],
		["document revision", { documentRevision: 5 }],
	])("rejects a completed intent with the wrong %s", (_label, mutation) => {
		expectIntegrityFailure({
			...templateQuote,
			pdfProvenance: { ...completedIntent, ...mutation },
		});
	});

	it.each([
		["renderer", { rendererVersion: "quotation-pdf-v2" }],
		["storage key", { artifactStorageKey: "quotations/replaced.pdf" }],
		["hash", { artifactSha256: "d".repeat(64) }],
		[
			"render time",
			{ artifactRenderedAt: new Date("2026-08-05T08:00:00Z") },
		],
		["page count", { artifactPageCount: 4 }],
		["byte size", { artifactByteSize: 1235 }],
	])("rejects a completed intent with the wrong artifact %s", (_label, mutation) => {
		expectIntegrityFailure({
			...templateQuote,
			pdfProvenance: { ...completedIntent, ...mutation },
		});
	});

	it.each([
		["non-completed", { ...completedIntent, status: "rendering" }],
		["incomplete", { ...completedIntent, artifactSha256: null }],
		["malformed", { ...completedIntent, artifactRenderedAt: "not-a-date" }],
	])("rejects %s template intent data", (_label, pdfProvenance) => {
		expectIntegrityFailure({ ...templateQuote, pdfProvenance });
	});

	it("returns null for incomplete legacy PDF evidence", () => {
		expect(
			buildQuotationPdfSnapshot({
				...legacyQuote,
				brandingSnapshot: null,
			}),
		).toBeNull();
	});

	it("rejects incomplete quote evidence when a template pointer exists", () => {
		expectIntegrityFailure({
			...templateQuote,
			pdfStorageKey: null,
		});
	});
});
