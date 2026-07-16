import { adminReleaseSubmission } from "./procedures/admin-release-submission";
import { claimSubmission } from "./procedures/claim-submission";
import { getSubmission } from "./procedures/get-submission";
import { listSubmissions } from "./procedures/list-submissions";
import { reassignSubmission } from "./procedures/reassign-submission";
import { releaseSubmission } from "./procedures/release-submission";
import { reviewSubmission } from "./procedures/review-submission";

export const submissionsRouter = {
	list: listSubmissions,
	get: getSubmission,
	claim: claimSubmission,
	release: releaseSubmission,
	adminRelease: adminReleaseSubmission,
	reassign: reassignSubmission,
	review: reviewSubmission,
};
