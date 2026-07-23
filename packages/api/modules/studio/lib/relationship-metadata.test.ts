import { describe, expect, it } from "vitest";
import {
	deliverableMetadataForCreate,
	deliverableMetadataForTaskAccess,
	deliverableMetadataForUpdate,
	taskMetadataForCreate,
	taskMetadataForDeliverableAccess,
	taskMetadataForUpdate,
} from "./relationship-metadata";

describe("relationship metadata access", () => {
	it("redacts source deliverable identity without deliverable access", () => {
		expect(
			taskMetadataForDeliverableAccess(
				{
					convertedFromDeliverableId: "deliverable-id",
					convertedFromDeliverableName: "Private gallery",
					preserved: true,
				},
				false,
			),
		).toEqual({ preserved: true });
	});

	it("redacts converted task identity without task access", () => {
		expect(
			deliverableMetadataForTaskAccess(
				{ convertedToTaskId: "task-id", convertedAt: "timestamp" },
				false,
			),
		).toEqual({ convertedAt: "timestamp" });
	});

	it("preserves relationship metadata when target access is allowed", () => {
		const metadata = { convertedToTaskId: "task-id" };
		expect(deliverableMetadataForTaskAccess(metadata, true)).toBe(metadata);
	});

	it("rejects forged conversion identity during creation", () => {
		expect(
			taskMetadataForCreate({
				convertedFromDeliverableId: "forged",
				custom: true,
			}),
		).toEqual({ custom: true });
		expect(
			deliverableMetadataForCreate({
				convertedToTaskId: "forged",
				custom: true,
			}),
		).toEqual({ custom: true });
	});

	it("protects deliverable conversion keys during metadata updates", () => {
		expect(
			deliverableMetadataForUpdate(
				{ convertedToTaskId: "forged", custom: true },
				{ convertedToTaskId: "real", convertedAt: "timestamp" },
			),
		).toEqual({
			convertedAt: "timestamp",
			convertedToTaskId: "real",
			custom: true,
		});
	});

	it("protects task conversion keys during metadata updates", () => {
		expect(
			taskMetadataForUpdate(null, {
				convertedFromDeliverableId: "deliverable-id",
				convertedFromDeliverableName: "Gallery",
			}),
		).toEqual({
			convertedFromDeliverableId: "deliverable-id",
			convertedFromDeliverableName: "Gallery",
		});
	});
});
