import { claimSubmission } from "./procedures/claim-submission";
import { getSubmission } from "./procedures/get-submission";
import { listSubmissions } from "./procedures/list-submissions";
import { reviewSubmission } from "./procedures/review-submission";

export const submissionsRouter = {
	list: listSubmissions,
	get: getSubmission,
	claim: claimSubmission,
	review: reviewSubmission,
};
