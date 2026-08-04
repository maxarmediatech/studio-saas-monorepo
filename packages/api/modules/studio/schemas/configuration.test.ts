import { describe, expect, it } from "vitest";
import {
	createConfigurationInputSchema,
	defaultConfigurations,
	parseConfigurationMetadata,
} from "./configuration";

const validInput = {
	type: "quotation_terms" as const,
	key: "wedding_terms",
	label: "Wedding terms",
	metadata: defaultConfigurations.quotation_terms[0]?.metadata,
};

describe("quotation terms configuration schema", () => {
	it("accepts the neutral versioned preset", () => {
		expect(
			createConfigurationInputSchema.safeParse(validInput).success,
		).toBe(true);
	});

	it("requires exactly three milestones totaling 100", () => {
		const metadata = structuredClone(validInput.metadata ?? {});
		if (!("paymentMilestones" in metadata)) {
			throw new Error("Missing fixture");
		}
		const firstMilestone = (
			metadata.paymentMilestones as Array<{ percentage: string }>
		)[0];
		if (!firstMilestone) {
			throw new Error("Missing milestone fixture");
		}
		firstMilestone.percentage = "39";
		expect(() =>
			parseConfigurationMetadata("quotation_terms", metadata),
		).toThrow();
	});

	it("rejects an unversioned rich-text blob", () => {
		expect(() =>
			parseConfigurationMetadata("quotation_terms", {
				terms: "all legal wording in one blob",
			}),
		).toThrow();
	});
});
