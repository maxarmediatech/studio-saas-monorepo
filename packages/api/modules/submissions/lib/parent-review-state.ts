export type AggregateWorkflowStatus =
	| "not_started"
	| "assigned"
	| "in_progress"
	| "blocked"
	| "submitted"
	| "in_review"
	| "revision_requested"
	| "ready"
	| "approved";

export type AssignmentProgressStatus = "assigned" | "in_progress" | "blocked";

export type SubmissionEvidenceStatus =
	| "draft"
	| "submitted"
	| "in_review"
	| "approved"
	| "rejected"
	| "revision_requested";

export function deriveParentReviewStatus(
	latestStatuses: Array<SubmissionEvidenceStatus | null>,
	assignmentProgress: AssignmentProgressStatus[],
): AggregateWorkflowStatus {
	if (latestStatuses.length === 0) {
		return "not_started";
	}

	const effectiveStatuses = latestStatuses.map((status, index) =>
		status !== null && status !== "draft"
			? status
			: (assignmentProgress[index] ?? "assigned"),
	);
	if (effectiveStatuses.every((status) => status === "approved")) {
		return "approved";
	}
	if (effectiveStatuses.some((status) => status === "blocked")) {
		return "blocked";
	}
	if (
		effectiveStatuses.some(
			(status) =>
				status === "revision_requested" || status === "rejected",
		)
	) {
		return "revision_requested";
	}
	if (effectiveStatuses.some((status) => status === "in_review")) {
		return "in_review";
	}
	if (
		effectiveStatuses.some(
			(status) => status === "submitted" || status === "approved",
		)
	) {
		return "submitted";
	}
	if (effectiveStatuses.some((status) => status === "in_progress")) {
		return "in_progress";
	}
	return "assigned";
}
