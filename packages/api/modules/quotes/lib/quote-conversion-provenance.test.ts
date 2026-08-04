import { describe, expect, it } from "vitest";
import {
	assertDocumentAcceptanceProvenance,
	documentEventsToShootPlan,
	documentEventsToShoots,
} from "./quote-conversion";

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
	it("materializes fixed quotation events as scheduled shoots", () => {
		expect(
			documentEventsToShoots([
				{
					documentKey: "wedding",
					eventType: "Wedding",
					side: "common",
					guestCount: "250",
					isTentative: false,
					eventDate: "2026-08-20",
					dateWindow: null,
					location: "Wedding venue",
					notes: "Arrive early",
					coverageNotes: "2 photographers, 1 cinematographer",
				},
				{
					documentKey: "tentative-reception",
					eventType: "Reception",
					side: "both",
					guestCount: null,
					isTentative: true,
					eventDate: null,
					dateWindow: "December 2026",
					location: null,
					notes: null,
					coverageNotes: null,
				},
			]),
		).toEqual([
			{
				name: "Wedding",
				shootType: "Wedding",
				side: "common",
				shootDate: "2026-08-20",
				venue: "Wedding venue",
				notes: "Arrive early\n\nPromised crew coverage: 2 photographers, 1 cinematographer",
				status: "scheduled",
				crewAssignments: [],
			},
		]);
	});

	it("preserves side and the source event index used for transactional linking", () => {
		const plan = documentEventsToShootPlan([
			{
				documentKey: "tentative",
				eventType: "Tentative event",
				side: "common",
				guestCount: null,
				isTentative: true,
				eventDate: null,
				dateWindow: "December 2026",
				location: null,
				notes: null,
				coverageNotes: null,
			},
			{
				documentKey: "separate-common",
				eventType: "Wedding",
				side: "separateCommon",
				guestCount: "300",
				isTentative: false,
				eventDate: "2026-12-12",
				dateWindow: null,
				location: "Venue",
				notes: null,
				coverageNotes: null,
			},
		]);

		expect(plan.eventIndexes).toEqual([1]);
		expect(plan.shoots).toEqual([
			expect.objectContaining({
				shootType: "Wedding",
				side: "separateCommon",
				shootDate: "2026-12-12",
			}),
		]);
	});

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
