import { CLASSIC_COPY_PROFILE_V1 } from "../../copy-profile";
import type { QuotationPdfTemplateDefinition } from "../../types";
import {
	countNeutralQuotationPdfPages,
	renderNeutralQuotationPdf,
} from "./render";

export const NEUTRAL_QUOTATION_TEMPLATE_ID = "neutral" as const;
export const NEUTRAL_QUOTATION_TEMPLATE_VERSION = 1 as const;
export const NEUTRAL_QUOTATION_RENDERER_VERSION =
	"quotation-pdf-neutral-v1" as const;

export const NEUTRAL_QUOTATION_TEMPLATE_RESOURCES = Object.freeze({
	fonts: Object.freeze([
		Object.freeze({ family: "Helvetica", source: "built-in" }),
		Object.freeze({ family: "Helvetica-Bold", source: "built-in" }),
	]),
	assets: Object.freeze([]),
});

const compatibility = Object.freeze({
	quotationDocumentVersions: Object.freeze([1]),
	brandingSchemaVersions: Object.freeze([1]),
	copyProfile: Object.freeze({
		id: CLASSIC_COPY_PROFILE_V1.id,
		version: CLASSIC_COPY_PROFILE_V1.version,
	}),
});

const manifest = Object.freeze({
	id: NEUTRAL_QUOTATION_TEMPLATE_ID,
	version: NEUTRAL_QUOTATION_TEMPLATE_VERSION,
	label: "Neutral",
	description: "A cover-led quotation with structured content pages.",
	thumbnailPath: "/images/quotation-templates/neutral-v1.png",
	status: "retired",
	rendererVersion: NEUTRAL_QUOTATION_RENDERER_VERSION,
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

export const NEUTRAL_QUOTATION_TEMPLATE = Object.freeze({
	manifest,
	copyProfile: CLASSIC_COPY_PROFILE_V1,
	render: renderNeutralQuotationPdf,
	countExplicitPages: countNeutralQuotationPdfPages,
} as const satisfies QuotationPdfTemplateDefinition);
