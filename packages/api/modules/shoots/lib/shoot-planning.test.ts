import { describe, expect, it } from "vitest";
import {
	buildShootPlanningMetadata,
	extractShootPlanningFields,
} from "./shoot-planning";

describe("shoot planning metadata", () => {
	it("normalizes missing metadata", () => {
		expect(extractShootPlanningFields(null)).toEqual({
			requiredCrewCount: null,
			additionalServices: [],
		});
	});

	it("extracts planning fields from metadata", () => {
		expect(
			extractShootPlanningFields({
				requiredCrewCount: 4,
				additionalServices: ["drone_service"],
			}),
		).toEqual({
			requiredCrewCount: 4,
			additionalServices: ["drone_service"],
		});
	});

	it("preserves unrelated metadata while updating planning fields", () => {
		expect(
			buildShootPlanningMetadata(
				{ notes: "keep", requiredCrewCount: 2 },
				{
					requiredCrewCount: 3,
					additionalServices: ["drone_service"],
				},
			),
		).toEqual({
			notes: "keep",
			requiredCrewCount: 3,
			additionalServices: ["drone_service"],
		});
	});

	it("removes empty planning metadata keys", () => {
		expect(
			buildShootPlanningMetadata(
				{
					requiredCrewCount: 2,
					additionalServices: ["drone_service"],
				},
				{
					requiredCrewCount: null,
					additionalServices: [],
				},
			),
		).toBeNull();
	});
});
