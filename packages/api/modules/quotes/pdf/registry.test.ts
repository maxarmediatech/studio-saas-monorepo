import { describe, expect, it } from "vitest";
import { CLASSIC_COPY_PROFILE_V1 } from "./copy-profile";
import { quotationPdfInputFixture } from "./quotation-pdf.fixture";
import {
	assertQuotationPdfTemplateCompatibility,
	QuotationPdfTemplateRegistry,
	QuotationPdfTemplateRegistryError,
	quotationPdfTemplateRegistry,
} from "./registry";
import { buildQuotationSemanticModel } from "./semantic-model";
import {
	CLASSIC_V0_QUOTATION_TEMPLATE,
	CLASSIC_V0_QUOTATION_TEMPLATE_ID,
	CLASSIC_V0_QUOTATION_TEMPLATE_VERSION,
} from "./templates/classic-v0";
import {
	CLASSIC_QUOTATION_TEMPLATE,
	CLASSIC_QUOTATION_TEMPLATE_ID,
	CLASSIC_QUOTATION_TEMPLATE_VERSION,
} from "./templates/classic-v1";
import {
	NEUTRAL_QUOTATION_RENDERER_VERSION,
	NEUTRAL_QUOTATION_TEMPLATE,
} from "./templates/neutral-v1";
import type {
	QuotationPdfInput,
	QuotationPdfTemplateDefinition,
} from "./types";

function expectRegistryCode(callback: () => unknown, code: string): void {
	try {
		callback();
	} catch (error) {
		expect(error).toBeInstanceOf(QuotationPdfTemplateRegistryError);
		expect((error as QuotationPdfTemplateRegistryError).code).toBe(code);
		return;
	}
	throw new Error(`Expected registry error ${code}`);
}

function definitionWith(
	changes: Partial<QuotationPdfTemplateDefinition["manifest"]>,
): QuotationPdfTemplateDefinition {
	return {
		...CLASSIC_QUOTATION_TEMPLATE,
		manifest: {
			...CLASSIC_QUOTATION_TEMPLATE.manifest,
			...changes,
		},
	};
}

describe("quotation PDF template registry", () => {
	it("keeps historical templates resolvable and exposes only Classic v0", () => {
		const classic = quotationPdfTemplateRegistry.getExact(
			CLASSIC_QUOTATION_TEMPLATE_ID,
			CLASSIC_QUOTATION_TEMPLATE_VERSION,
		);
		const neutral = quotationPdfTemplateRegistry.getExact("neutral", 1);
		const classicV0 = quotationPdfTemplateRegistry.getExact(
			CLASSIC_V0_QUOTATION_TEMPLATE_ID,
			CLASSIC_V0_QUOTATION_TEMPLATE_VERSION,
		);
		expect(classic).toBe(CLASSIC_QUOTATION_TEMPLATE);
		expect(classic.manifest).toMatchObject({
			id: "classic",
			version: 1,
			thumbnailPath: "/images/quotation-templates/classic-v1.png",
			status: "retired",
		});
		expect(neutral).toBe(NEUTRAL_QUOTATION_TEMPLATE);
		expect(neutral.manifest).toMatchObject({
			id: "neutral",
			version: 1,
			label: "Neutral",
			thumbnailPath: "/images/quotation-templates/neutral-v1.png",
			status: "retired",
			rendererVersion: NEUTRAL_QUOTATION_RENDERER_VERSION,
			composerVersion: 1,
			compatibility: {
				quotationDocumentVersions: [1],
				brandingSchemaVersions: [1],
				copyProfile: { id: "classic", version: 1 },
			},
		});
		expect(classicV0).toBe(CLASSIC_V0_QUOTATION_TEMPLATE);
		expect(classicV0.manifest).toMatchObject({
			id: "classic",
			version: 2,
			label: "Classic v0",
			thumbnailPath: "/images/quotation-templates/classic-v0.png",
			status: "active",
			rendererVersion: "quotation-pdf-classic-v0",
		});
		for (const definition of [classic, neutral, classicV0]) {
			expect(Object.isFrozen(definition)).toBe(true);
			expect(Object.isFrozen(definition.manifest)).toBe(true);
			expect(Object.isFrozen(definition.manifest.compatibility)).toBe(
				true,
			);
			expect(Object.isFrozen(definition.copyProfile)).toBe(true);
		}
		expect(quotationPdfTemplateRegistry.listActive()).toEqual([classicV0]);
	});

	it("distinguishes unknown IDs from unsupported versions", () => {
		expectRegistryCode(
			() => quotationPdfTemplateRegistry.getExact("unknown", 1),
			"UNKNOWN_TEMPLATE",
		);
		expectRegistryCode(
			() => quotationPdfTemplateRegistry.getExact("classic", 3),
			"UNSUPPORTED_TEMPLATE_VERSION",
		);
		expectRegistryCode(
			() => quotationPdfTemplateRegistry.getExact("neutral", 2),
			"UNSUPPORTED_TEMPLATE_VERSION",
		);
	});

	it("resolves retired versions exactly but excludes them from active use", () => {
		const retired = definitionWith({ id: "retired", status: "retired" });
		const registry = new QuotationPdfTemplateRegistry([retired]);
		expect(registry.getExact("retired", 1)).toBe(retired);
		expect(registry.listActive()).toEqual([]);
		expectRegistryCode(
			() => registry.getActive("retired", 1),
			"RETIRED_TEMPLATE",
		);
	});

	it("rejects duplicate identities and mismatched copy profiles", () => {
		expectRegistryCode(
			() =>
				new QuotationPdfTemplateRegistry([
					CLASSIC_QUOTATION_TEMPLATE,
					CLASSIC_QUOTATION_TEMPLATE,
				]),
			"DUPLICATE_TEMPLATE",
		);
		const mismatched = {
			...CLASSIC_QUOTATION_TEMPLATE,
			copyProfile: { ...CLASSIC_COPY_PROFILE_V1, version: 2 },
		};
		expectRegistryCode(
			() => new QuotationPdfTemplateRegistry([mismatched]),
			"INVALID_COPY_PROFILE",
		);
	});

	it("validates document and branding compatibility", () => {
		const input = quotationPdfInputFixture();
		for (const definition of [
			CLASSIC_QUOTATION_TEMPLATE,
			NEUTRAL_QUOTATION_TEMPLATE,
			CLASSIC_V0_QUOTATION_TEMPLATE,
		]) {
			expect(() =>
				assertQuotationPdfTemplateCompatibility(definition, input),
			).not.toThrow();
		}
		const documentV2 = {
			...input,
			document: { ...input.document, schemaVersion: 2 },
		} as unknown as QuotationPdfInput;
		expectRegistryCode(
			() =>
				assertQuotationPdfTemplateCompatibility(
					CLASSIC_QUOTATION_TEMPLATE,
					documentV2,
				),
			"INCOMPATIBLE_QUOTATION_DOCUMENT",
		);
		const brandingV2 = {
			...input,
			branding: { ...input.branding, schemaVersion: 2 },
		} as unknown as QuotationPdfInput;
		expectRegistryCode(
			() =>
				assertQuotationPdfTemplateCompatibility(
					CLASSIC_QUOTATION_TEMPLATE,
					brandingV2,
				),
			"INCOMPATIBLE_BRANDING",
		);
	});
});

describe("classic quotation semantic model", () => {
	it("preserves approved copy, ordering, formatting, and source relationships", () => {
		const model = buildQuotationSemanticModel(quotationPdfInputFixture());
		expect(CLASSIC_COPY_PROFILE_V1).toMatchObject({
			id: "classic",
			version: 1,
			sections: {
				preparedFor: "Prepared for",
				packageOptions: "Package options",
				paymentPlan: "Payment plan",
			},
		});
		expect(model.metadata).toEqual([
			{
				semanticId: "quote.number",
				label: "Quote",
				value: "QT-2026-0001 · v1",
			},
			{
				semanticId: "quote.date",
				label: "Quotation date",
				value: "3 Aug 2026",
			},
			{
				semanticId: "quote.validUntil",
				label: "Valid until",
				value: "17 Aug 2026",
			},
		]);
		expect(model.participants[0]).toMatchObject({
			key: "participant-1",
			title: "A",
		});
		expect(
			model.events[0]?.rows.map(({ label, value }) => [label, value]),
		).toEqual([
			["Side", "Bride side"],
			["Guests", "200"],
			["Date", "10 Dec 2026"],
			["Location", "Jaipur"],
			["Notes", null],
		]);
		expect(model.packages[0]).toMatchObject({
			key: "package-1",
			name: "Classic",
			price: "INR 1,000.01",
			recommended: true,
			coverage: [
				{
					key: "package-1-event-1-coverage",
					label: "Ceremony",
					value: "2 photographers",
				},
			],
			deliverables: [
				{ key: "package-1-deliverable-1", text: "Album × 1" },
			],
		});
		expect(model.packages[0]?.payments.map(({ amount }) => amount)).toEqual(
			["INR 333.30", "INR 333.30", "INR 333.41"],
		);
	});

	it("exposes stable source identities separately from renderer keys", () => {
		const input = quotationPdfInputFixture();
		const event = input.document.events[0];
		if (!event) {
			throw new Error("Fixture is incomplete");
		}
		input.document.events.push({
			...event,
			key: "event-2",
			eventType: { ...event.eventType, label: "Reception" },
		});
		input.document.fixedTerms = [{ key: "term-1", text: "Fixed term" }];
		const model = buildQuotationSemanticModel(input);
		const eventModel = model.events[0];
		const packageModel = model.packages[0];
		if (!eventModel || !packageModel) {
			throw new Error("Semantic fixture is incomplete");
		}

		expect(model.titleSemanticId).toBe("quote.title");
		expect(model.metadata.map(({ semanticId }) => semanticId)).toEqual([
			"quote.number",
			"quote.date",
			"quote.validUntil",
		]);
		expect(model.participants[0]?.titleSemanticId).toBe(
			"participant.participant-1.name",
		);
		expect(
			eventModel.rows
				.filter(({ label }) => label === "Date" || label === "Location")
				.map(({ semanticId }) => semanticId),
		).toEqual(["event.event-1.date", "event.event-1.location"]);
		expect(packageModel.priceSemanticId).toBe("package.package-1.price");
		expect(packageModel.coverage[0]).toMatchObject({
			key: "package-1-event-1-coverage",
			semanticId: "package.package-1.coverage.coverage-1",
		});
		const missingCoverage = packageModel.coverage[1];
		expect(missingCoverage).toMatchObject({
			key: "package-1-event-2-coverage",
			semanticId: "package.package-1.coverage-missing.event.event-2",
			value: "Not specified",
		});
		expect(missingCoverage?.semanticId).not.toContain(".coverage.");
		expect(packageModel.deliverables[0]?.semanticId).toBe(
			"package.package-1.deliverable.deliverable-1",
		);
		expect(packageModel.payments[0]?.semanticId).toBe(
			"payment.payment-1.timing",
		);
		expect(model.paymentTiming[0]?.semanticId).toBe(
			"payment.payment-1.timing",
		);
		expect(model.terms[0]?.semanticId).toBe("term.term-1.text");
	});
});
