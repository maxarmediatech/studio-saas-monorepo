import type {
	QuotationBrandingSnapshotV1,
	QuotationDocumentV1,
} from "../../studio/schemas/quotation-document";

export interface QuotationPdfInput {
	document: QuotationDocumentV1;
	branding: QuotationBrandingSnapshotV1;
	quoteNumber: string;
	quoteVersion: number;
	validUntil: string | null;
	createdAt: string;
	logoDataUri?: string;
}

export type QuotationPdfTemplateStatus = "active" | "retired";

export interface QuotationPdfTemplateCompatibility {
	readonly quotationDocumentVersions: readonly number[];
	readonly brandingSchemaVersions: readonly number[];
	readonly copyProfile: {
		readonly id: string;
		readonly version: number;
	};
}

export interface QuotationPdfTemplateManifest {
	readonly id: string;
	readonly version: number;
	readonly label: string;
	readonly description: string;
	readonly thumbnailPath: string;
	readonly status: QuotationPdfTemplateStatus;
	readonly rendererVersion: string;
	readonly composerVersion: number;
	readonly compatibility: QuotationPdfTemplateCompatibility;
	readonly supportedFeatures: readonly string[];
}

export interface QuotationPdfCopyProfile {
	readonly id: string;
	readonly version: number;
	readonly metadata: {
		readonly quote: string;
		readonly quotationDate: string;
		readonly validUntil: string;
	};
	readonly sections: {
		readonly quotation: string;
		readonly preparedFor: string;
		readonly events: string;
		readonly packageOptions: string;
		readonly coverage: string;
		readonly deliverables: string;
		readonly paymentPlan: string;
		readonly deliveryTimelines: string;
		readonly paymentTiming: string;
		readonly terms: string;
	};
	readonly labels: {
		readonly email: string;
		readonly phone: string;
		readonly address: string;
		readonly side: string;
		readonly guests: string;
		readonly date: string;
		readonly location: string;
		readonly notes: string;
		readonly milestone: string;
		readonly percentage: string;
		readonly amount: string;
		readonly recommended: string;
		readonly noDeliverables: string;
		readonly notSpecified: string;
		readonly notScheduled: string;
	};
}

export interface QuotationPdfTemplateDefinition {
	readonly manifest: QuotationPdfTemplateManifest;
	readonly copyProfile: QuotationPdfCopyProfile;
	render(input: QuotationPdfInput): Promise<Buffer>;
	countExplicitPages(input: QuotationPdfInput): number;
}
