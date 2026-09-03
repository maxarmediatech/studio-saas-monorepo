import { CLASSIC_V0_QUOTATION_TEMPLATE } from "./templates/classic-v0";
import { CLASSIC_QUOTATION_TEMPLATE } from "./templates/classic-v1";
import { NEUTRAL_QUOTATION_TEMPLATE } from "./templates/neutral-v1";
import type {
	QuotationPdfInput,
	QuotationPdfTemplateDefinition,
} from "./types";

export type QuotationPdfTemplateRegistryErrorCode =
	| "DUPLICATE_TEMPLATE"
	| "INVALID_COPY_PROFILE"
	| "UNKNOWN_TEMPLATE"
	| "UNSUPPORTED_TEMPLATE_VERSION"
	| "RETIRED_TEMPLATE"
	| "INCOMPATIBLE_QUOTATION_DOCUMENT"
	| "INCOMPATIBLE_BRANDING";

export class QuotationPdfTemplateRegistryError extends Error {
	constructor(
		readonly code: QuotationPdfTemplateRegistryErrorCode,
		message: string,
	) {
		super(message);
		this.name = "QuotationPdfTemplateRegistryError";
	}
}

function templateKey(id: string, version: number): string {
	return `${id}@${version}`;
}

function validateDefinition(definition: QuotationPdfTemplateDefinition): void {
	const expected = definition.manifest.compatibility.copyProfile;
	if (
		definition.copyProfile.id !== expected.id ||
		definition.copyProfile.version !== expected.version
	) {
		throw new QuotationPdfTemplateRegistryError(
			"INVALID_COPY_PROFILE",
			`Template ${templateKey(definition.manifest.id, definition.manifest.version)} has an incompatible copy profile`,
		);
	}
}

export function assertQuotationPdfTemplateCompatibility(
	definition: QuotationPdfTemplateDefinition,
	input: QuotationPdfInput,
): void {
	const compatibility = definition.manifest.compatibility;
	if (
		!compatibility.quotationDocumentVersions.includes(
			input.document.schemaVersion,
		)
	) {
		throw new QuotationPdfTemplateRegistryError(
			"INCOMPATIBLE_QUOTATION_DOCUMENT",
			`Template ${templateKey(definition.manifest.id, definition.manifest.version)} does not support quotation document version ${input.document.schemaVersion}`,
		);
	}
	if (
		!compatibility.brandingSchemaVersions.includes(
			input.branding.schemaVersion,
		)
	) {
		throw new QuotationPdfTemplateRegistryError(
			"INCOMPATIBLE_BRANDING",
			`Template ${templateKey(definition.manifest.id, definition.manifest.version)} does not support branding version ${input.branding.schemaVersion}`,
		);
	}
}

export class QuotationPdfTemplateRegistry {
	private readonly definitions: Map<string, QuotationPdfTemplateDefinition>;
	private readonly versionsById: Map<string, Set<number>>;

	constructor(definitions: readonly QuotationPdfTemplateDefinition[]) {
		this.definitions = new Map();
		this.versionsById = new Map();
		for (const definition of definitions) {
			validateDefinition(definition);
			const { id, version } = definition.manifest;
			const key = templateKey(id, version);
			if (this.definitions.has(key)) {
				throw new QuotationPdfTemplateRegistryError(
					"DUPLICATE_TEMPLATE",
					`Duplicate quotation PDF template ${key}`,
				);
			}
			this.definitions.set(key, definition);
			const versions = this.versionsById.get(id) ?? new Set<number>();
			versions.add(version);
			this.versionsById.set(id, versions);
		}
	}

	getExact(id: string, version: number): QuotationPdfTemplateDefinition {
		const definition = this.definitions.get(templateKey(id, version));
		if (definition) {
			return definition;
		}
		if (this.versionsById.has(id)) {
			throw new QuotationPdfTemplateRegistryError(
				"UNSUPPORTED_TEMPLATE_VERSION",
				`Quotation PDF template ${id} does not have version ${version}`,
			);
		}
		throw new QuotationPdfTemplateRegistryError(
			"UNKNOWN_TEMPLATE",
			`Unknown quotation PDF template ${id}`,
		);
	}

	getActive(id: string, version: number): QuotationPdfTemplateDefinition {
		const definition = this.getExact(id, version);
		if (definition.manifest.status !== "active") {
			throw new QuotationPdfTemplateRegistryError(
				"RETIRED_TEMPLATE",
				`Quotation PDF template ${templateKey(id, version)} is retired`,
			);
		}
		return definition;
	}

	listActive(): readonly QuotationPdfTemplateDefinition[] {
		return [...this.definitions.values()].filter(
			(definition) => definition.manifest.status === "active",
		);
	}
}

export const quotationPdfTemplateRegistry = new QuotationPdfTemplateRegistry([
	CLASSIC_QUOTATION_TEMPLATE,
	NEUTRAL_QUOTATION_TEMPLATE,
	CLASSIC_V0_QUOTATION_TEMPLATE,
]);
