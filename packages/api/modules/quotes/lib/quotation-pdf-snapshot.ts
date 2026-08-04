import {
	type QuotationPdfSnapshotV1,
	quotationBrandingSnapshotV1Schema,
	quotationPdfSnapshotV1Schema,
} from "../../studio/schemas/quotation-document";

export function buildQuotationPdfSnapshot(input: {
	pdfRendererVersion: string | null;
	pdfStorageKey: string | null;
	pdfSha256: string | null;
	pdfRenderedAt: Date | null;
	pdfPageCount: number | null;
	pdfByteSize: number | null;
	brandingSnapshot: unknown;
}): QuotationPdfSnapshotV1 | null {
	const branding = quotationBrandingSnapshotV1Schema.safeParse(
		input.brandingSnapshot,
	);
	if (
		!input.pdfRendererVersion ||
		!input.pdfStorageKey ||
		!input.pdfSha256 ||
		!input.pdfRenderedAt ||
		!input.pdfPageCount ||
		!input.pdfByteSize ||
		!branding.success
	) {
		return null;
	}

	return quotationPdfSnapshotV1Schema.parse({
		rendererVersion: input.pdfRendererVersion,
		storageKey: input.pdfStorageKey,
		sha256: input.pdfSha256,
		renderedAt: input.pdfRenderedAt.toISOString(),
		pageCount: input.pdfPageCount,
		byteSize: input.pdfByteSize,
		branding: branding.data,
	});
}
