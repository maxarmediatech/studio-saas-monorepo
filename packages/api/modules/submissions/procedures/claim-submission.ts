import { ORPCError } from "@orpc/server";
import {
	and,
	eq,
	assignmentSubmissions,
	db,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	claimSubmissionInputSchema,
	claimSubmissionOutputSchema,
} from "../../studio/schemas/submission";

export const claimSubmission = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/submissions/{id}/claim",
		tags: ["Submissions"],
		summary: "Claim submission",
		description: "Claim a submission for review (marks as in_review)",
	})
	.input(claimSubmissionInputSchema)
	.output(claimSubmissionOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "review", "claim");

		const { id } = input;

		// Fetch submission
		const submission = await db.query.assignmentSubmissions.findFirst({
			where: and(
				eq(assignmentSubmissions.id, id),
				eq(assignmentSubmissions.organizationId, context.organizationId),
			),
		});

		if (!submission) {
			throw new ORPCError("NOT_FOUND", {
				message: "Submission not found",
			});
		}

		// Check if already claimed by someone else
		if (
			submission.status === "in_review" &&
			submission.reviewedBy &&
			submission.reviewedBy !== context.user.id
		) {
			throw new ORPCError("CONFLICT", {
				message: "Submission is already being reviewed by another user",
			});
		}

		if (submission.status === "in_review" && submission.reviewedBy === context.user.id) {
			return {
				data: { id },
				message: "Submission is already claimed",
			};
		}

		if (submission.status !== "submitted" && submission.status !== "in_review") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Only submitted work can be claimed for review",
			});
		}

		// Claim the submission
		await db
			.update(assignmentSubmissions)
			.set({
				status: "in_review",
				reviewedBy: context.user.id,
				updatedAt: new Date(),
			})
			.where(eq(assignmentSubmissions.id, id));

		return {
			data: { id },
			message: "Submission claimed for review",
		};
	});
