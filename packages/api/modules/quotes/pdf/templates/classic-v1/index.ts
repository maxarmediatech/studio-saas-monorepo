import { QUOTATION_PDF_RENDERER_VERSION } from "../../../../studio/schemas/quotation-document";
import { CLASSIC_COPY_PROFILE_V1 } from "../../copy-profile";
import type { QuotationPdfTemplateDefinition } from "../../types";
import {
	countClassicQuotationPdfPages,
	renderClassicQuotationPdf,
} from "./render";

export const CLASSIC_QUOTATION_TEMPLATE_ID = "classic" as const;
export const CLASSIC_QUOTATION_TEMPLATE_VERSION = 1 as const;

const compatibility = Object.freeze({
	quotationDocumentVersions: Object.freeze([1]),
	brandingSchemaVersions: Object.freeze([1]),
	copyProfile: Object.freeze({
		id: CLASSIC_COPY_PROFILE_V1.id,
		version: CLASSIC_COPY_PROFILE_V1.version,
	}),
});

const manifest = Object.freeze({
	id: CLASSIC_QUOTATION_TEMPLATE_ID,
	version: CLASSIC_QUOTATION_TEMPLATE_VERSION,
	label: "Classic",
	description: "The original Stuwiz quotation PDF layout.",
	thumbnailPath: "/images/quotation-templates/classic-v1.png",
	status: "retired",
	rendererVersion: QUOTATION_PDF_RENDERER_VERSION,
	composerVersion: 1,
	compatibility,
	supportedFeatures: Object.freeze([
		"participants",
		"events",
		"packages",
		"coverage",
		"deliverables",
		"payment-milestones",
		"delivery-timelines",
		"fixed-terms",
		"branding-logo",
	]),
} as const);

export const CLASSIC_QUOTATION_TEMPLATE = Object.freeze({
	manifest,
	copyProfile: CLASSIC_COPY_PROFILE_V1,
	render: renderClassicQuotationPdf,
	countExplicitPages: countClassicQuotationPdfPages,
} as const satisfies QuotationPdfTemplateDefinition);
