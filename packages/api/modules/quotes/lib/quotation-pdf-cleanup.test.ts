import { describe, expect, it } from "vitest";
import { selectUnreferencedQuotationPdfKeys } from "./quotation-pdf-cleanup";

describe("quotation PDF cleanup", () => {
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
