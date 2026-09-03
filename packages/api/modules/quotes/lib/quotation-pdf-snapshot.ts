import { z } from "zod";
import {
	type QuotationPdfProvenanceV1,
	type QuotationPdfSnapshotV1,
	quotationBrandingSnapshotV1Schema,
	quotationPdfProvenanceV1Schema,
	quotationPdfSnapshotV1Schema,
} from "../../studio/schemas/quotation-document";

export const QUOTATION_PDF_PROVENANCE_INTEGRITY_ERROR =
	"Quotation PDF provenance integrity check failed";

export class QuotationPdfProvenanceIntegrityError extends Error {
	constructor() {
		super(QUOTATION_PDF_PROVENANCE_INTEGRITY_ERROR);
		this.name = "QuotationPdfProvenanceIntegrityError";
	}
}

const completedQuotationPdfIntentSchema = z.object({
	id: z.string().min(1).max(255),
	quoteId: z.string().min(1).max(255),
	quoteVersion: z.number().int().positive(),
	documentRevision: z.number().int().nonnegative(),
	selectionVersion: z.number().int().positive(),
	sourceFingerprint: z.string().length(64),
	brandingFingerprint: z.string().length(64),
	templateId: z.string().min(1).max(100),
	templateVersion: z.number().int().positive(),
	copyProfileVersion: z.number().int().positive(),
	composerVersion: z.number().int().positive(),
	rendererVersion: z.string().min(1).max(100),
	artifactStorageKey: z.string().min(1).max(2000),
	artifactSha256: z.string().length(64),
	artifactRenderedAt: z.date(),
	artifactPageCount: z.number().int().positive(),
	artifactByteSize: z
		.number()
		.int()
		.positive()
		.max(20 * 1024 * 1024),
	status: z.literal("completed"),
});

export type CompletedQuotationPdfProvenance = z.infer<
	typeof completedQuotationPdfIntentSchema
>;

export function buildQuotationPdfProvenance(
	intent: unknown,
): QuotationPdfProvenanceV1 | null {
	const completedIntent = completedQuotationPdfIntentSchema.safeParse(intent);
	if (!completedIntent.success) {
		return null;
	}
	const value = completedIntent.data;
	const provenance = quotationPdfProvenanceV1Schema.safeParse({
		renderIntentId: value.id,
		quotationId: value.quoteId,
		quotationVersion: value.quoteVersion,
		documentRevision: value.documentRevision,
		selectionVersion: value.selectionVersion,
		sourceFingerprint: value.sourceFingerprint,
		brandingFingerprint: value.brandingFingerprint,
		templateId: value.templateId,
		templateVersion: value.templateVersion,
		copyProfileVersion: value.copyProfileVersion,
		composerVersion: value.composerVersion,
		rendererVersion: value.rendererVersion,
		artifactSha256: value.artifactSha256,
		artifactByteSize: value.artifactByteSize,
		pageCount: value.artifactPageCount,
		storageKey: value.artifactStorageKey,
		renderedAt: value.artifactRenderedAt.toISOString(),
	});
	return provenance.success ? provenance.data : null;
}

export type QuotationPdfSnapshotInput = {
	id: string;
	version: number;
	documentRevision: number;
	pdfRenderIntentId: string | null;
	pdfRendererVersion: string | null;
	pdfStorageKey: string | null;
	pdfSha256: string | null;
	pdfRenderedAt: Date | null;
	pdfPageCount: number | null;
	pdfByteSize: number | null;
	brandingSnapshot: unknown;
	pdfProvenance?: unknown;
};

function provenanceMatchesQuote(
	provenance: QuotationPdfProvenanceV1,
	input: QuotationPdfSnapshotInput,
): boolean {
	return (
		provenance.renderIntentId === input.pdfRenderIntentId &&
		provenance.quotationId === input.id &&
		provenance.quotationVersion === input.version &&
		provenance.documentRevision === input.documentRevision &&
		provenance.rendererVersion === input.pdfRendererVersion &&
		provenance.storageKey === input.pdfStorageKey &&
		provenance.artifactSha256 === input.pdfSha256 &&
		provenance.renderedAt === input.pdfRenderedAt?.toISOString() &&
		provenance.pageCount === input.pdfPageCount &&
		provenance.artifactByteSize === input.pdfByteSize
	);
}

export function buildQuotationPdfSnapshot(
	input: QuotationPdfSnapshotInput,
): QuotationPdfSnapshotV1 | null {
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
		if (input.pdfRenderIntentId !== null) {
			throw new QuotationPdfProvenanceIntegrityError();
		}
		return null;
	}

	if (input.pdfRenderIntentId === null) {
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

	const provenance = buildQuotationPdfProvenance(input.pdfProvenance);
	if (!provenance || !provenanceMatchesQuote(provenance, input)) {
		throw new QuotationPdfProvenanceIntegrityError();
	}

	return quotationPdfSnapshotV1Schema.parse({
		rendererVersion: input.pdfRendererVersion,
		storageKey: input.pdfStorageKey,
		sha256: input.pdfSha256,
		renderedAt: input.pdfRenderedAt.toISOString(),
		pageCount: input.pdfPageCount,
		byteSize: input.pdfByteSize,
		branding: branding.data,
		provenance,
	});
}
