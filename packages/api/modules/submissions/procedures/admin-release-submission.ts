import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requireOrganizationAdmin } from "../../studio/lib/permissions";
import {
	adminReleaseSubmissionInputSchema,
	releaseSubmissionOutputSchema,
} from "../../studio/schemas/submission";
import { administrativelyReleaseReview } from "../lib/review-claim-service";

export const adminReleaseSubmission = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/submissions/{id}/admin-release",
		tags: ["Submissions"],
		summary: "Release stale review claim",
		description:
			"Owner/admin override for a review claim stale over 24 hours",
	})
	.input(adminReleaseSubmissionInputSchema)
	.output(releaseSubmissionOutputSchema)
	.handler(async ({ input, context }) => {
		requireOrganizationAdmin(context);
		await administrativelyReleaseReview(context, input);
		return { data: { id: input.id }, message: "Stale claim released" };
	});
