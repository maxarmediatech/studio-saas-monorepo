import { describe, expect, it } from "vitest";
import { updateDeliverableAssignmentStatusInputSchema } from "./deliverable";
import { updateTaskAssignmentStatusInputSchema } from "./task";

describe.each([
	["task", updateTaskAssignmentStatusInputSchema],
	["deliverable", updateDeliverableAssignmentStatusInputSchema],
] as const)("%s assignment progress input", (_entityType, schema) => {
	const id = "00000000-0000-4000-8000-000000000001";

	it("requires blocker details", () => {
		expect(
			schema.safeParse({ id, status: "blocked" }).success,
		).toBe(false);
		expect(
			schema.safeParse({
				id,
				status: "blocked",
				note: "Waiting for client selects",
			}).success,
		).toBe(true);
	});

	it("allows progress changes without a stale note", () => {
		expect(
			schema.safeParse({ id, status: "in_progress" }).success,
		).toBe(true);
	});
});
