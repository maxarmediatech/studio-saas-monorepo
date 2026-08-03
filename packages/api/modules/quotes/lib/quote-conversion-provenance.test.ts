import { describe, expect, it } from "vitest";
import { assertDocumentAcceptanceProvenance } from "./quote-conversion";

const branding = {
	schemaVersion: 1 as const,
	organizationName: "Studio",
	address: null,
	email: null,
	phone: null,
	taxIdentifier: null,
	timezone: "Asia/Kolkata",
	logoStorageKey: null,
	logoMimeType: null,
	logoSha256: null,
};

describe("document quote conversion provenance", () => {
	it("rejects an accepted PDF identity that differs from the immutable quote", () => {
		const quote = {
			documentSha256: "a".repeat(64),
			pdfSha256: "b".repeat(64),
			pdfStorageKey: "quotations/org/quote/v1/pdf.pdf",
			pdfRendererVersion: "quotation-pdf-v1",
			pdfPageCount: 3,
			pdfByteSize: 1234,
		};
		const acceptance = {
			documentSha256: quote.documentSha256,
			pdfSnapshot: {
				rendererVersion: quote.pdfRendererVersion,
				storageKey: quote.pdfStorageKey,
				sha256: quote.pdfSha256,
				renderedAt: "2026-08-03T00:00:00.000Z",
				pageCount: quote.pdfPageCount,
				byteSize: quote.pdfByteSize,
				branding,
			},
		};
		expect(() =>
			assertDocumentAcceptanceProvenance(acceptance, quote),
		).not.toThrow();
		expect(() =>
			assertDocumentAcceptanceProvenance(
				{
					...acceptance,
					pdfSnapshot: {
						...acceptance.pdfSnapshot,
						storageKey: "quotations/org/quote/v1/replaced.pdf",
					},
				},
				quote,
			),
		).toThrow(/provenance mismatch/);
	});
});
