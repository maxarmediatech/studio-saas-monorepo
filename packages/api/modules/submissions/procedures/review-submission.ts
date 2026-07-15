import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	reviewSubmissionInputSchema,
	reviewSubmissionOutputSchema,
} from "../../studio/schemas/submission";
import { decideSubmissionReview } from "../lib/review-decision-service";

export const reviewSubmission = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/submissions/{id}/review",
		tags: ["Submissions"],
		summary: "Review submission",
		description: "Decide a submission currently claimed by this reviewer",
	})
	.input(reviewSubmissionInputSchema)
	.output(reviewSubmissionOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "review", "review");
		await decideSubmissionReview(context, input);
		const messages = {
			approve: "Submission approved",
			request_revision: "Revision requested",
			reject: "Submission rejected",
		};
		return { data: { id: input.id }, message: messages[input.decision] };
	});
