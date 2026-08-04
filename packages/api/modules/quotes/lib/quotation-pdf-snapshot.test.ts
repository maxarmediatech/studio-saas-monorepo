import { describe, expect, it } from "vitest";
import { buildQuotationPdfSnapshot } from "./quotation-pdf-snapshot";

const completeSnapshot = {
	pdfRendererVersion: "quotation-pdf-v1",
	pdfStorageKey: "quotations/org/quote/v1/pdf.pdf",
	pdfSha256: "a".repeat(64),
	pdfRenderedAt: new Date("2026-08-04T08:00:00.000Z"),
	pdfPageCount: 3,
	pdfByteSize: 1234,
	brandingSnapshot: {
		schemaVersion: 1,
		organizationName: "Studio One",
		address: null,
		email: null,
		phone: null,
		taxIdentifier: null,
		timezone: "Asia/Kolkata",
		logoStorageKey: null,
		logoMimeType: null,
		logoSha256: null,
	},
};

describe("buildQuotationPdfSnapshot", () => {
	it("includes the immutable branding used to render the PDF", () => {
		expect(buildQuotationPdfSnapshot(completeSnapshot)).toEqual({
			rendererVersion: "quotation-pdf-v1",
			storageKey: "quotations/org/quote/v1/pdf.pdf",
			sha256: "a".repeat(64),
			renderedAt: "2026-08-04T08:00:00.000Z",
			pageCount: 3,
			byteSize: 1234,
			branding: completeSnapshot.brandingSnapshot,
		});
	});

	it("does not expose an incomplete PDF snapshot", () => {
		expect(
			buildQuotationPdfSnapshot({
				...completeSnapshot,
				brandingSnapshot: null,
			}),
		).toBeNull();
	});
});
