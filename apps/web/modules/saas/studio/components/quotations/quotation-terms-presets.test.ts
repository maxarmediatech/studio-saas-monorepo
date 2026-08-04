import { randomUUID } from "node:crypto";
import type { Configuration } from "@repo/api/modules/studio/schemas/configuration";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
	applyQuotationTermsPreset,
	clearQuotationTermsPreset,
	customizeQuotationTerms,
	eligibleQuotationTermsPresets,
	quotationTermsHaveContent,
	selectDefaultQuotationTermsPreset,
} from "./quotation-terms-presets";

beforeAll(() => {
	vi.stubGlobal("crypto", { randomUUID });
});

import { createDefaultQuotationDraft } from "./quotation-wizard-data";

function preset(overrides: Partial<Configuration> = {}): Configuration {
	return {
		id: "terms-1",
		organizationId: "org-1",
		type: "quotation_terms",
		key: "wedding_terms",
		label: "Wedding terms",
		description: null,
		color: null,
		icon: null,
		sortOrder: 0,
		isDefault: true,
		isSystem: false,
		isActive: true,
		metadata: {
			schemaVersion: 1,
			deliveryTimelines: [{ key: "photos", text: "Photos in 8 weeks" }],
			paymentMilestones: [
				{
					key: "one",
					label: "One",
					percentage: "40",
					timing: "Booking",
				},
				{
					key: "two",
					label: "Two",
					percentage: "50",
					timing: "Transfer",
				},
				{
					key: "three",
					label: "Three",
					percentage: "10",
					timing: "Delivery",
				},
			],
			fixedTerms: [{ key: "backup", text: "Backup for 90 days" }],
		},
		defaultCost: null,
		bookingTypeFilter: "wedding",
		createdAt: "2026-08-04T00:00:00.000Z",
		updatedAt: "2026-08-04T00:00:00.000Z",
		...overrides,
	};
}

describe("quotation terms presets", () => {
	it("treats the neutral schedule as content that requires safe replacement", () => {
		expect(quotationTermsHaveContent(createDefaultQuotationDraft())).toBe(
			true,
		);
	});

	it("filters and defaults by booking type", () => {
		const rows = [
			preset(),
			preset({ id: "all", bookingTypeFilter: null, isDefault: false }),
		];
		expect(
			eligibleQuotationTermsPresets(rows, "portrait").map(({ id }) => id),
		).toEqual(["all"]);
		expect(selectDefaultQuotationTermsPreset(rows, "wedding")?.id).toBe(
			"terms-1",
		);
		expect(selectDefaultQuotationTermsPreset(rows, "portrait")).toBeNull();
	});

	it("copies content and provenance without live linkage", () => {
		const configuration = preset();
		const applied = applyQuotationTermsPreset(
			createDefaultQuotationDraft("2026-08-04"),
			configuration,
		);
		expect(applied?.termsConfiguration?.label).toBe("Wedding terms");
		expect(applied?.payments.map(({ percent }) => percent)).toEqual([
			"40",
			"50",
			"10",
		]);
		const firstTerm = (
			configuration.metadata as { fixedTerms: Array<{ text: string }> }
		).fixedTerms[0];
		if (!firstTerm) {
			throw new Error("Missing fixed-term fixture");
		}
		firstTerm.text = "Changed later";
		expect(applied?.terms).toEqual(["Backup for 90 days"]);
	});

	it("clears clauses and returns to neutral payments", () => {
		const applied = applyQuotationTermsPreset(
			createDefaultQuotationDraft(),
			preset(),
		);
		if (!applied) {
			throw new Error("Missing applied fixture");
		}
		const cleared = clearQuotationTermsPreset(applied);
		expect(cleared.termsConfiguration).toBeNull();
		expect(cleared.timelines).toEqual([]);
		expect(cleared.terms).toEqual([]);
		expect(cleared.payments.map(({ percent }) => percent)).toEqual([
			"40",
			"50",
			"10",
		]);
	});

	it("marks manual edits as Custom", () => {
		const applied = applyQuotationTermsPreset(
			createDefaultQuotationDraft(),
			preset(),
		);
		if (!applied) {
			throw new Error("Missing applied fixture");
		}
		const customized = customizeQuotationTerms(applied, {
			terms: ["Studio-approved custom clause"],
		});
		expect(customized.termsConfiguration).toBeNull();
		expect(customized.terms).toEqual(["Studio-approved custom clause"]);
	});
});
