import { describe, expect, it } from "vitest";
import { requestedQuotationRevision } from "./quotation-pdf-route";

describe("quotation PDF preview route", () => {
	it("uses the revision query parameter emitted by PreviewStep", () => {
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
});
