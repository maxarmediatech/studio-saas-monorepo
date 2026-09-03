import { describe, expect, it } from "vitest";
import {
	collectQuotationPdfReferenceKeys,
	selectUnreferencedQuotationPdfKeys,
} from "./quotation-pdf-cleanup";

describe("quotation PDF cleanup", () => {
	it("retains quote, completed-intent, and acceptance evidence", () => {
		const referenced = collectQuotationPdfReferenceKeys({
			quoteKeys: ["quotations/legacy-quote.pdf"],
			intentKeys: ["quotations/template-intent.pdf"],
			acceptanceSnapshots: [
				{
					rendererVersion: "quotation-pdf-v1",
					storageKey: "quotations/accepted.pdf",
					sha256: "a".repeat(64),
					renderedAt: "2026-08-01T00:00:00.000Z",
					pageCount: 1,
					byteSize: 100,
					branding: {
						schemaVersion: 1,
						organizationName: "Studio",
						address: null,
						email: null,
						phone: null,
						taxIdentifier: null,
						timezone: "Asia/Kolkata",
						logoStorageKey: null,
						logoMimeType: null,
						logoSha256: null,
					},
				},
			],
		});
		expect([...referenced].sort()).toEqual([
			"quotations/accepted.pdf",
			"quotations/legacy-quote.pdf",
			"quotations/template-intent.pdf",
		]);
	});

	it("deletes only old unreferenced quotation objects", () => {
		const cutoff = new Date("2026-08-02T00:00:00.000Z");
		expect(
			selectUnreferencedQuotationPdfKeys(
				[
					{
						key: "quotations/org/old.pdf",
						lastModified: new Date("2026-08-01T00:00:00.000Z"),
					},
					{
						key: "quotations/org/kept.pdf",
						lastModified: new Date("2026-08-01T00:00:00.000Z"),
					},
					{
						key: "quotations/org/new.pdf",
						lastModified: new Date("2026-08-03T00:00:00.000Z"),
					},
				],
				new Set(["quotations/org/kept.pdf"]),
				cutoff,
			),
		).toEqual(["quotations/org/old.pdf"]);
	});
});
