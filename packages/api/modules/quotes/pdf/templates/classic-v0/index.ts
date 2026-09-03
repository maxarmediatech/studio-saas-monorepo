import { CLASSIC_COPY_PROFILE_V1 } from "../../copy-profile";
import type { QuotationPdfTemplateDefinition } from "../../types";
import {
	countClassicV0QuotationPdfPages,
	renderClassicV0QuotationPdf,
} from "./render";

export const CLASSIC_V0_QUOTATION_TEMPLATE_ID = "classic" as const;
export const CLASSIC_V0_QUOTATION_TEMPLATE_VERSION = 2 as const;
export const CLASSIC_V0_QUOTATION_RENDERER_VERSION =
	"quotation-pdf-classic-v0" as const;

export const CLASSIC_V0_QUOTATION_RESOURCES = Object.freeze({
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
	id: CLASSIC_V0_QUOTATION_TEMPLATE_ID,
	version: CLASSIC_V0_QUOTATION_TEMPLATE_VERSION,
	label: "Classic v0",
	description: "A clean, structured quotation for everyday use.",
	thumbnailPath: "/images/quotation-templates/classic-v0.png",
	status: "active",
	rendererVersion: CLASSIC_V0_QUOTATION_RENDERER_VERSION,
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

export const CLASSIC_V0_QUOTATION_TEMPLATE = Object.freeze({
	manifest,
	copyProfile: CLASSIC_COPY_PROFILE_V1,
	render: renderClassicV0QuotationPdf,
	countExplicitPages: countClassicV0QuotationPdfPages,
} as const satisfies QuotationPdfTemplateDefinition);
