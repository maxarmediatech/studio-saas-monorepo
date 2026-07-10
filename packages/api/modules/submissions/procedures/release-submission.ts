import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	releaseSubmissionInputSchema,
	releaseSubmissionOutputSchema,
} from "../../studio/schemas/submission";
import { releaseSubmissionReview } from "../lib/review-claim-service";

export const releaseSubmission = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/submissions/{id}/release",
		tags: ["Submissions"],
		summary: "Release review claim",
		description: "Return your active review claim to the submitted queue",
	})
	.input(releaseSubmissionInputSchema)
	.output(releaseSubmissionOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "review", "claim");
		await releaseSubmissionReview(context, input);
		return { data: { id: input.id }, message: "Review claim released" };
	});
