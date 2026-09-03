import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { QUOTATION_PDF_RENDERER_VERSION } from "../../studio/schemas/quotation-document";
import { quotationDocumentFixture } from "../pdf/quotation-pdf.fixture";
import { canonicalQuotationJson } from "./quotation-document";
import { renderAndStoreFrozenQuotationPdf } from "./quotation-render-artifact";

const hash = (value: unknown) =>
	createHash("sha256").update(canonicalQuotationJson(value)).digest("hex");

function frozenIntent() {
	const document = quotationDocumentFixture();
	const branding = {
		schemaVersion: 1 as const,
		organizationName: "Quotation Artifact Studio",
		address: null,
		email: null,
		phone: null,
		taxIdentifier: null,
		timezone: "Asia/Kolkata",
		logoStorageKey: null,
		logoMimeType: null,
		logoSha256: null,
	};
	return {
		organizationId: "org_1",
		quoteId: "quote_1",
		quoteVersion: 1,
		sourceDocument: {
			schemaVersion: 1 as const,
			document,
			quoteNumber: "QA-Q-2608-0001",
			quoteVersion: 1,
			validUntil: "2026-08-17T18:29:59.999Z",
			createdAt: "2026-08-03T10:00:00.000Z",
		},
		sourceFingerprint: hash(document),
		brandingSnapshot: branding,
		brandingFingerprint: hash(branding),
		templateId: "classic",
		templateVersion: 1,
		copyProfileVersion: 1,
		composerVersion: 1,
		rendererVersion: QUOTATION_PDF_RENDERER_VERSION,
	};
}

describe("frozen quotation PDF artifact rendering", () => {
	it("retries storage from frozen input and converges on one exact key", async () => {
		const objects = new Map<string, Buffer>();
		const put = vi
			.fn<(key: string, bytes: Buffer) => Promise<void>>()
			.mockRejectedValueOnce(new Error("Storage unavailable"))
			.mockImplementation(async (key, bytes) => {
				objects.set(key, bytes);
			});
		const dependencies = {
			readObjectBytes: async (key: string) => objects.get(key) ?? null,
			putObjectBytes: put,
			now: () => new Date("2026-08-10T00:00:00.000Z"),
		};

		await expect(
			renderAndStoreFrozenQuotationPdf(frozenIntent(), dependencies),
		).rejects.toThrow("Storage unavailable");
		const first = await renderAndStoreFrozenQuotationPdf(
			frozenIntent(),
			dependencies,
		);
		const retry = await renderAndStoreFrozenQuotationPdf(
			frozenIntent(),
			dependencies,
		);
		expect(retry).toEqual(first);
		expect(first.storageKey).toBe(
			`quotations/org_1/quote_1/v1/${first.sha256}.pdf`,
		);
		expect(objects).toHaveLength(1);
	});

	it("fails closed when private storage returns different bytes", async () => {
		await expect(
			renderAndStoreFrozenQuotationPdf(frozenIntent(), {
				putObjectBytes: async () => undefined,
				readObjectBytes: async () =>
					Buffer.from("not the rendered PDF"),
				now: () => new Date(),
			}),
		).rejects.toThrow(
			"Historical quotation PDF failed integrity verification",
		);
	});
});
