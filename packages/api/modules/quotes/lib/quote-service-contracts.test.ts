import { describe, expect, it } from "vitest";
import {
	assertLegacyDraftWriteBoundary,
	buildDocumentRevisionFields,
	resolveQuoteSendMode,
} from "./quote-service-contracts";

describe("quote service document contracts", () => {
	it("rejects legacy writes against the canonical document boundary", () => {
		expect(() =>
			assertLegacyDraftWriteBoundary({
				status: "draft",
				documentVersion: 1,
			}),
		).toThrow(/document API/);
	});

	it("dispatches generic send through the document renderer revision", () => {
		expect(
			resolveQuoteSendMode({ documentVersion: 1, documentRevision: 7 }),
		).toEqual({ kind: "document", revision: 7 });
		expect(
			resolveQuoteSendMode({
				documentVersion: null,
				documentRevision: 0,
			}),
		).toEqual({ kind: "legacy" });
	});

	it("copies the canonical document and clears all generated PDF state", () => {
		const document = { schemaVersion: 1, title: "Exact snapshot" };
		expect(
			buildDocumentRevisionFields({
				document,
				documentSha256: "a".repeat(64),
			}),
		).toEqual({
			documentVersion: 1,
			document,
			documentSha256: "a".repeat(64),
			documentRevision: 1,
			brandingSnapshot: null,
			pdfStorageKey: null,
			pdfSha256: null,
			pdfRenderedAt: null,
			pdfRendererVersion: null,
			pdfPageCount: null,
			pdfByteSize: null,
		});
	});
});
