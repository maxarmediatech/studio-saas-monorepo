import { z } from "zod";
import { strictQuotationDocumentV1Schema } from "../../studio/schemas/quotation-document";

/**
 * Stored in the immutable source_document JSON column. The envelope freezes
 * renderer-visible quote metadata alongside the canonical quotation document.
 */
export const frozenQuotationPdfSourceSchema = z.object({
	schemaVersion: z.literal(1),
	document: strictQuotationDocumentV1Schema,
	quoteNumber: z.string().min(1),
	quoteVersion: z.number().int().positive(),
	validUntil: z.string().datetime().nullable(),
	createdAt: z.string().datetime(),
	// Exact normalized logo bytes; retries never depend on mutable object storage.
	logoDataUri: z
		.string()
		.max(3 * 1024 * 1024)
		.optional(),
});

export type FrozenQuotationPdfSource = z.infer<
	typeof frozenQuotationPdfSourceSchema
>;
