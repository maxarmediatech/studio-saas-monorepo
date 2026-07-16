export type AggregateWorkflowStatus =
	| "not_started"
	| "assigned"
	| "submitted"
	| "in_review"
	| "revision_requested"
	| "approved";

export type SubmissionEvidenceStatus =
	| "draft"
	| "submitted"
	| "in_review"
	| "approved"
	| "rejected"
	| "revision_requested";

export function deriveParentReviewStatus(
	latestStatuses: Array<SubmissionEvidenceStatus | null>,
): AggregateWorkflowStatus {
	if (latestStatuses.length === 0) {
		return "not_started";
	}

	const progressed = latestStatuses.filter(
		(status): status is Exclude<SubmissionEvidenceStatus, "draft"> =>
			status !== null && status !== "draft",
	);
	if (progressed.length === 0) {
		return "assigned";
	}
	if (
		progressed.length === latestStatuses.length &&
		progressed.every((status) => status === "approved")
	) {
		return "approved";
	}
	if (
		progressed.some(
			(status) =>
				status === "revision_requested" || status === "rejected",
		)
	) {
		return "revision_requested";
	}
	if (progressed.some((status) => status === "in_review")) {
		return "in_review";
	}
	if (progressed.some((status) => status === "submitted")) {
		return "submitted";
	}

	// At least one assignee progressed to approval, but another assignee has
	// no submitted work. The parent remains submitted until all approve.
	return "submitted";
}
