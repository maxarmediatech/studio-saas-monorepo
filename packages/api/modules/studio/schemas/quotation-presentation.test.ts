import { describe, expect, it } from "vitest";
import {
	getQuotationPresentationOutputSchema,
	selectQuotationTemplateInputSchema,
	sendDocumentQuoteInputSchema,
} from "./quote";

const quoteId = "00000000-0000-4000-8000-000000000001";
const intentId = "00000000-0000-4000-8000-000000000002";

describe("quotation presentation API schemas", () => {
	it("keeps existing unmaterialized sends on explicit null selection identity", () => {
		expect(
			sendDocumentQuoteInputSchema.parse({
				id: quoteId,
				expectedDocumentRevision: 1,
			}),
		).toMatchObject({ expectedSelectionVersion: null });
	});

	it("requires both concurrency versions for template selection", () => {
		expect(
			selectQuotationTemplateInputSchema.safeParse({
				id: quoteId,
				templateId: "classic",
				templateVersion: 1,
				expectedDocumentRevision: 1,
			}).success,
		).toBe(false);
	});

	it("exposes retry-safe failed intent diagnostics without frozen source", () => {
		expect(
			getQuotationPresentationOutputSchema.parse({
				data: {
					documentRevision: 2,
					selectionVersion: 3,
					templateId: "classic",
					templateVersion: 1,
					persisted: true,
					renderIntent: {
						id: intentId,
						status: "failed",
						attemptCount: 2,
						lastErrorCode: "STORAGE_FAILED",
						lastErrorMessage: "Storage unavailable",
						lastAttemptAt: "2026-08-10T00:00:00.000Z",
						createdAt: "2026-08-09T00:00:00.000Z",
						updatedAt: "2026-08-10T00:00:00.000Z",
					},
				},
			}).data.renderIntent,
		).toMatchObject({ id: intentId, status: "failed", attemptCount: 2 });
	});
});
