import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	claimSubmissionInputSchema,
	claimSubmissionOutputSchema,
} from "../../studio/schemas/submission";
import { claimSubmissionForReview } from "../lib/review-claim-service";

export const claimSubmission = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/submissions/{id}/claim",
		tags: ["Submissions"],
		summary: "Claim submission",
		description: "Atomically claim a submitted item for review",
	})
	.input(claimSubmissionInputSchema)
	.output(claimSubmissionOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "review", "claim");
		const result = await claimSubmissionForReview(context, input.id);
		return {
			data: { id: result.id },
			message: result.alreadyClaimed
				? "Submission is already claimed by you"
				: "Submission claimed for review",
		};
	});
