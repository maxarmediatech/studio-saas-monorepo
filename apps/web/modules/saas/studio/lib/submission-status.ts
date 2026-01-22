export type SubmissionStatus =
	| "draft"
	| "submitted"
	| "in_review"
	| "approved"
	| "rejected"
	| "revision_requested";

export type WorkflowStatus =
	| "not_started"
	| "assigned"
	| "submitted"
	| "in_review"
	| "revision_requested"
	| "approved";

export function getSubmissionStatusLabel(status: SubmissionStatus): string {
	switch (status) {
		case "approved":
			return "approved";
		case "rejected":
			return "rejected";
		case "revision_requested":
			return "requested revision";
		case "in_review":
			return "started review";
		case "submitted":
			return "submitted";
		default:
			return status;
	}
}
