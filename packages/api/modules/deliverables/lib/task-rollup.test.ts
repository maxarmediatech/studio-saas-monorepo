import { describe, expect, it } from "vitest";
import { deriveTaskBasedDeliverableStatus } from "./task-rollup";

describe("deriveTaskBasedDeliverableStatus", () => {
	it.each([
		[[], "not_started"],
		[["not_started"], "not_started"],
		[["assigned", "not_started"], "assigned"],
		[["in_progress", "approved"], "submitted"],
		[["submitted", "in_progress"], "submitted"],
		[["in_review", "submitted"], "in_review"],
		[["revision_requested", "approved"], "revision_requested"],
		[["blocked", "in_review"], "blocked"],
		[["approved", "approved"], "ready"],
	] as const)("maps required task statuses %j to %s", (statuses, expected) => {
		expect(deriveTaskBasedDeliverableStatus([...statuses])).toBe(expected);
	});
});
