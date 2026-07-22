import { describe, expect, it } from "vitest";
import { deriveParentReviewProjection } from "./parent-review-aggregate";
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
		expect(
			deriveParentReviewStatus(
				[...statuses],
				statuses.map(() => "assigned"),
			),
		).toBe(expected);
	});

	it.each([
		[[null], ["in_progress"], "in_progress"],
		[[null], ["blocked"], "blocked"],
		[["submitted"], ["blocked"], "submitted"],
		[[null, "submitted"], ["blocked", "assigned"], "blocked"],
		[[null, "approved"], ["in_progress", "assigned"], "submitted"],
	] as const)("combines submission evidence %j and assignment progress %j as %s", (statuses, progress, expected) => {
		expect(deriveParentReviewStatus([...statuses], [...progress])).toBe(
			expected,
		);
	});
});

describe("deriveParentReviewProjection", () => {
	const firstApproval = new Date("2025-04-10T10:00:00.000Z");
	const finalApproval = new Date("2025-04-11T12:30:00.000Z");
	const submission = (input: {
		id: string;
		submittedBy: string;
		status: "submitted" | "approved";
		submittedAt: Date;
		reviewedAt: Date | null;
	}) => ({ ...input, createdAt: input.submittedAt });

	it("derives approval time from the final relevant sibling approval", () => {
		expect(
			deriveParentReviewProjection(
				[
					{ crewId: "crew-a", progressStatus: "assigned" },
					{ crewId: "crew-b", progressStatus: "assigned" },
				],
				[
					submission({
						id: "submission-a",
						submittedBy: "crew-a",
						status: "approved",
						submittedAt: firstApproval,
						reviewedAt: firstApproval,
					}),
					submission({
						id: "submission-b",
						submittedBy: "crew-b",
						status: "approved",
						submittedAt: finalApproval,
						reviewedAt: finalApproval,
					}),
				],
			),
		).toEqual({
			workflowStatus: "approved",
			approvalTime: finalApproval,
			approvalTimeEvidenceComplete: true,
		});
	});

	it("marks approved history with a missing review timestamp incomplete", () => {
		expect(
			deriveParentReviewProjection(
				[{ crewId: "crew-a", progressStatus: "assigned" }],
				[
					submission({
						id: "submission-a",
						submittedBy: "crew-a",
						status: "approved",
						submittedAt: finalApproval,
						reviewedAt: null,
					}),
				],
			),
		).toEqual({
			workflowStatus: "approved",
			approvalTime: null,
			approvalTimeEvidenceComplete: false,
		});
	});

	it("uses only each assignee's latest submission", () => {
		expect(
			deriveParentReviewProjection(
				[{ crewId: "crew-a", progressStatus: "assigned" }],
				[
					submission({
						id: "older-approved",
						submittedBy: "crew-a",
						status: "approved",
						submittedAt: firstApproval,
						reviewedAt: firstApproval,
					}),
					submission({
						id: "newer-submitted",
						submittedBy: "crew-a",
						status: "submitted",
						submittedAt: finalApproval,
						reviewedAt: null,
					}),
				],
			),
		).toEqual({
			workflowStatus: "submitted",
			approvalTime: null,
			approvalTimeEvidenceComplete: true,
		});
	});
});
