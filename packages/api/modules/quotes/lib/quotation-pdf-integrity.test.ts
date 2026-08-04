import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyStoredQuotationPdfBytes } from "./quotation-pdf-service";

describe("stored quotation PDF integrity", () => {
	it("accepts exact immutable bytes and rejects replacement or truncation", () => {
		const bytes = Buffer.from("immutable quotation pdf");
		const expected = {
			sha256: createHash("sha256").update(bytes).digest("hex"),
			byteSize: bytes.byteLength,
		};
		expect(() =>
			verifyStoredQuotationPdfBytes(bytes, expected),
		).not.toThrow();
		expect(() =>
			verifyStoredQuotationPdfBytes(Buffer.from("replacement"), expected),
		).toThrow(/integrity verification/);
		expect(() =>
			verifyStoredQuotationPdfBytes(bytes, {
				...expected,
				byteSize: bytes.byteLength + 1,
			}),
		).toThrow(/integrity verification/);
	});
});
