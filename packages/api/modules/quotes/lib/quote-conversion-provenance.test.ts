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

function quoteEvidence(pdfRenderIntentId: string | null) {
	return {
		id: "quote-1",
		version: 1,
		documentRevision: 2,
		documentSha256: "a".repeat(64),
		pdfRenderIntentId,
		pdfSha256: "b".repeat(64),
		pdfStorageKey: "quotations/org/quote/v1/pdf.pdf",
		pdfRenderedAt: new Date("2026-08-03T00:00:00.000Z"),
		pdfRendererVersion: "quotation-pdf-v1",
		pdfPageCount: 3,
		pdfByteSize: 1234,
		brandingSnapshot: branding,
	};
}

function completedIntent() {
	const quote = quoteEvidence("intent-1");
	return {
		id: "intent-1",
		quoteId: quote.id,
		quoteVersion: quote.version,
		documentRevision: quote.documentRevision,
		selectionVersion: 1,
		sourceFingerprint: "c".repeat(64),
		brandingFingerprint: "d".repeat(64),
		templateId: "classic",
		templateVersion: 1,
		copyProfileVersion: 1,
		composerVersion: 1,
		rendererVersion: quote.pdfRendererVersion,
		artifactStorageKey: quote.pdfStorageKey,
		artifactSha256: quote.pdfSha256,
		artifactRenderedAt: quote.pdfRenderedAt,
		artifactPageCount: quote.pdfPageCount,
		artifactByteSize: quote.pdfByteSize,
		status: "completed" as const,
	};
}

function intentProvenance(intent = completedIntent()) {
	return {
		renderIntentId: intent.id,
		quotationId: intent.quoteId,
		quotationVersion: intent.quoteVersion,
		documentRevision: intent.documentRevision,
		selectionVersion: intent.selectionVersion,
		sourceFingerprint: intent.sourceFingerprint,
		brandingFingerprint: intent.brandingFingerprint,
		templateId: intent.templateId,
		templateVersion: intent.templateVersion,
		copyProfileVersion: intent.copyProfileVersion,
		composerVersion: intent.composerVersion,
		rendererVersion: intent.rendererVersion,
		artifactSha256: intent.artifactSha256,
		artifactByteSize: intent.artifactByteSize,
		pageCount: intent.artifactPageCount,
		storageKey: intent.artifactStorageKey,
		renderedAt: intent.artifactRenderedAt.toISOString(),
	};
}

function acceptedPdf(provenance?: ReturnType<typeof intentProvenance>) {
	const quote = quoteEvidence(provenance?.renderIntentId ?? null);
	return {
		documentSha256: quote.documentSha256,
		pdfSnapshot: {
			rendererVersion: quote.pdfRendererVersion,
			storageKey: quote.pdfStorageKey,
			sha256: quote.pdfSha256,
			renderedAt: quote.pdfRenderedAt.toISOString(),
			pageCount: quote.pdfPageCount,
			byteSize: quote.pdfByteSize,
			branding,
			...(provenance ? { provenance } : {}),
		},
	};
}

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

	it("accepts legacy evidence and rejects an altered artifact", () => {
		const quote = {
			id: "quote-1",
			version: 1,
			documentRevision: 2,
			documentSha256: "a".repeat(64),
			pdfRenderIntentId: null,
			pdfSha256: "b".repeat(64),
			pdfStorageKey: "quotations/org/quote/v1/pdf.pdf",
			pdfRenderedAt: new Date("2026-08-03T00:00:00.000Z"),
			pdfRendererVersion: "quotation-pdf-v1",
			pdfPageCount: 3,
			pdfByteSize: 1234,
			brandingSnapshot: branding,
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
		).toThrow(/integrity check failed/);
	});

	it("requires accepted template provenance to match the completed intent", () => {
		const quote = {
			id: "quote-1",
			version: 1,
			documentRevision: 2,
			documentSha256: "a".repeat(64),
			pdfRenderIntentId: "intent-1",
			pdfSha256: "b".repeat(64),
			pdfStorageKey: "quotations/org/quote/v1/pdf.pdf",
			pdfRenderedAt: new Date("2026-08-03T00:00:00.000Z"),
			pdfRendererVersion: "quotation-pdf-v1",
			pdfPageCount: 3,
			pdfByteSize: 1234,
			brandingSnapshot: branding,
		};
		const intent = {
			id: "intent-1",
			quoteId: "quote-1",
			quoteVersion: 1,
			documentRevision: 2,
			selectionVersion: 1,
			sourceFingerprint: "c".repeat(64),
			brandingFingerprint: "d".repeat(64),
			templateId: "classic",
			templateVersion: 1,
			copyProfileVersion: 1,
			composerVersion: 1,
			rendererVersion: quote.pdfRendererVersion,
			artifactStorageKey: quote.pdfStorageKey,
			artifactSha256: quote.pdfSha256,
			artifactRenderedAt: new Date("2026-08-03T00:00:00.000Z"),
			artifactPageCount: quote.pdfPageCount,
			artifactByteSize: quote.pdfByteSize,
			status: "completed",
		};
		const provenance = {
			renderIntentId: intent.id,
			quotationId: intent.quoteId,
			quotationVersion: intent.quoteVersion,
			documentRevision: intent.documentRevision,
			selectionVersion: intent.selectionVersion,
			sourceFingerprint: intent.sourceFingerprint,
			brandingFingerprint: intent.brandingFingerprint,
			templateId: intent.templateId,
			templateVersion: intent.templateVersion,
			copyProfileVersion: intent.copyProfileVersion,
			composerVersion: intent.composerVersion,
			rendererVersion: intent.rendererVersion,
			artifactSha256: intent.artifactSha256,
			artifactByteSize: intent.artifactByteSize,
			pageCount: intent.artifactPageCount,
			storageKey: intent.artifactStorageKey,
			renderedAt: intent.artifactRenderedAt.toISOString(),
		};
		const acceptance = {
			documentSha256: quote.documentSha256,
			pdfSnapshot: {
				rendererVersion: quote.pdfRendererVersion,
				storageKey: quote.pdfStorageKey,
				sha256: quote.pdfSha256,
				renderedAt: intent.artifactRenderedAt.toISOString(),
				pageCount: quote.pdfPageCount,
				byteSize: quote.pdfByteSize,
				branding,
				provenance,
			},
		};
		expect(() =>
			assertDocumentAcceptanceProvenance(acceptance, quote, intent),
		).not.toThrow();
		expect(() =>
			assertDocumentAcceptanceProvenance(
				{
					...acceptance,
					pdfSnapshot: {
						...acceptance.pdfSnapshot,
						provenance: { ...provenance, templateVersion: 2 },
					},
				},
				quote,
				intent,
			),
		).toThrow(/integrity check failed/);
	});

	it("rejects any template provenance on legacy acceptance evidence", () => {
		const quote = quoteEvidence(null);
		expect(() =>
			assertDocumentAcceptanceProvenance(
				acceptedPdf(),
				quote,
				completedIntent(),
			),
		).toThrow(/integrity check failed/);
		expect(() =>
			assertDocumentAcceptanceProvenance(
				acceptedPdf(intentProvenance()),
				quote,
			),
		).toThrow(/integrity check failed/);
	});

	it("rejects a template pointer with missing or incomplete intent data", () => {
		const quote = quoteEvidence("intent-1");
		const acceptance = acceptedPdf(intentProvenance());
		expect(() =>
			assertDocumentAcceptanceProvenance(acceptance, quote, null),
		).toThrow(/integrity check failed/);
		expect(() =>
			assertDocumentAcceptanceProvenance(acceptance, quote, {
				...completedIntent(),
				status: "rendering",
			}),
		).toThrow(/integrity check failed/);
	});

	it.each([
		["pointer", { id: "intent-2" }],
		["quote", { quoteId: "quote-2" }],
		["version", { quoteVersion: 2 }],
		["revision", { documentRevision: 3 }],
		["artifact", { artifactSha256: "e".repeat(64) }],
	])("rejects template intent %s mismatch", (_label, mutation) => {
		const quote = quoteEvidence("intent-1");
		expect(() =>
			assertDocumentAcceptanceProvenance(
				acceptedPdf(intentProvenance()),
				quote,
				{ ...completedIntent(), ...mutation },
			),
		).toThrow(/integrity check failed/);
	});
});
