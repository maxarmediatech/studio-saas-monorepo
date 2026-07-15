import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requireOrganizationAdmin } from "../../studio/lib/permissions";
import {
	reassignSubmissionInputSchema,
	reassignSubmissionOutputSchema,
} from "../../studio/schemas/submission";
import { administrativelyReassignReview } from "../lib/review-claim-service";

export const reassignSubmission = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/submissions/{id}/reassign",
		tags: ["Submissions"],
		summary: "Reassign stale review claim",
		description:
			"Owner/admin override assigning a stale claim to another member",
	})
	.input(reassignSubmissionInputSchema)
	.output(reassignSubmissionOutputSchema)
	.handler(async ({ input, context }) => {
		requireOrganizationAdmin(context);
		const result = await administrativelyReassignReview(context, input);
		return {
			data: { id: input.id },
			message: result.alreadyAssigned
				? "Reviewer is already assigned"
				: "Stale claim reassigned",
		};
	});
