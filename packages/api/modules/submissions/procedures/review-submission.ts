import { ORPCError } from "@orpc/server";
import {
	and,
	assignmentSubmissions,
	db,
	deliverables,
	eq,
	tasks,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	reviewSubmissionInputSchema,
	reviewSubmissionOutputSchema,
} from "../../studio/schemas/submission";

export const reviewSubmission = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/submissions/{id}/review",
		tags: ["Submissions"],
		summary: "Review submission",
		description:
			"Submit a review decision (approve, request revision, or reject)",
	})
	.input(reviewSubmissionInputSchema)
	.output(reviewSubmissionOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "review", "review");

		const { id, decision, reviewNote } = input;

		// Fetch submission
		const submission = await db.query.assignmentSubmissions.findFirst({
			where: and(
				eq(assignmentSubmissions.id, id),
				eq(
					assignmentSubmissions.organizationId,
					context.organizationId,
				),
			),
		});

		if (!submission) {
			throw new ORPCError("NOT_FOUND", {
				message: "Submission not found",
			});
		}

		// Check if already completed
		if (["approved", "rejected"].includes(submission.status)) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Submission has already been ${submission.status}`,
			});
		}

		if (submission.status !== "in_review") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Submission must be claimed before review",
			});
		}

		if (
			submission.reviewedBy &&
			submission.reviewedBy !== context.user.id
		) {
			throw new ORPCError("CONFLICT", {
				message: "Submission is already being reviewed by another user",
			});
		}

		if (!submission.reviewedBy) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Submission must be claimed before review",
			});
		}

		// Map decision to status
		const statusMap = {
			approve: "approved" as const,
			request_revision: "revision_requested" as const,
			reject: "rejected" as const,
		};
		const newStatus = statusMap[decision];

		// Map decision to workflow status for the entity
		const workflowStatusMap = {
			approve: "approved" as const,
			request_revision: "revision_requested" as const,
			reject: "revision_requested" as const, // Rejected still allows retry
		};
		const newWorkflowStatus = workflowStatusMap[decision];

		// Use transaction to update both submission and entity
		await db.transaction(async (tx) => {
			// Update submission
			await tx
				.update(assignmentSubmissions)
				.set({
					status: newStatus,
					reviewedBy: context.user.id,
					reviewedAt: new Date(),
					reviewNote: reviewNote ?? null,
					updatedAt: new Date(),
				})
				.where(eq(assignmentSubmissions.id, id));

			// Update the associated entity's workflow status
			if (submission.taskId) {
				await tx
					.update(tasks)
					.set({
						workflowStatus: newWorkflowStatus,
						completedAt: decision === "approve" ? new Date() : null,
						updatedAt: new Date(),
						updatedBy: context.user.id,
					})
					.where(eq(tasks.id, submission.taskId));
			} else if (submission.deliverableId) {
				await tx
					.update(deliverables)
					.set({
						workflowStatus: newWorkflowStatus,
						deliveredAt: decision === "approve" ? new Date() : null,
						updatedAt: new Date(),
						updatedBy: context.user.id,
					})
					.where(eq(deliverables.id, submission.deliverableId));
			}
		});

		const messages = {
			approve: "Submission approved",
			request_revision: "Revision requested",
			reject: "Submission rejected",
		};

		return {
			data: { id },
			message: messages[decision],
		};
	});
