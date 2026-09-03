import { quotationPdfTemplateRegistry } from "./registry";
import {
	CLASSIC_QUOTATION_TEMPLATE_ID,
	CLASSIC_QUOTATION_TEMPLATE_VERSION,
} from "./templates/classic-v1";
import { ClassicQuotationPdfDocument } from "./templates/classic-v1/render";
import type { QuotationPdfInput } from "./types";

export { formatQuotationValidUntil } from "./formatting";
export { chunkPdfText } from "./templates/classic-v1/layout";
export type { QuotationPdfInput } from "./types";

const classicTemplate = quotationPdfTemplateRegistry.getExact(
	CLASSIC_QUOTATION_TEMPLATE_ID,
	CLASSIC_QUOTATION_TEMPLATE_VERSION,
);

export function countExplicitQuotationPdfPages(
	input: QuotationPdfInput,
): number {
	return classicTemplate.countExplicitPages(input);
}

export function QuotationPdfDocument(
	input: QuotationPdfInput,
): ReturnType<typeof ClassicQuotationPdfDocument> {
	return ClassicQuotationPdfDocument(input);
}

/** Legacy facade retained for exact historical Classic v1 rendering. */
export function renderQuotationPdf(input: QuotationPdfInput): Promise<Buffer> {
	return classicTemplate.render(input);
}

export function countPdfPages(bytes: Buffer): number {
	const matches = bytes.toString("latin1").match(/\/Type\s*\/Page\b/g);
	return Math.max(1, matches?.length ?? 1);
}
