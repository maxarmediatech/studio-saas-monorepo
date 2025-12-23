import { listSubmissions } from "./procedures/list-submissions";
import { getSubmission } from "./procedures/get-submission";
import { claimSubmission } from "./procedures/claim-submission";
import { reviewSubmission } from "./procedures/review-submission";

export const submissionsRouter = {
	list: listSubmissions,
	get: getSubmission,
	claim: claimSubmission,
	review: reviewSubmission,
};
