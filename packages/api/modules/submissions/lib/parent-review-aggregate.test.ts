import { describe, expect, it } from "vitest";
import { deriveParentReviewStatus } from "./parent-review-state";

describe("deriveParentReviewStatus", () => {
	it.each([
		[[], "not_started"],
		[[null, null], "assigned"],
		[["draft", null], "assigned"],
		[["submitted", null], "submitted"],
		[["approved", null], "submitted"],
		[["submitted", "in_review"], "in_review"],
		[["approved", "revision_requested"], "revision_requested"],
		[["approved", "rejected"], "revision_requested"],
		[["approved", "approved"], "approved"],
	] as const)("maps %j to %s", (statuses, expected) => {
		expect(deriveParentReviewStatus([...statuses])).toBe(expected);
	});
});
