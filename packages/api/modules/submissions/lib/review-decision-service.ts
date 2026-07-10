import { ORPCError } from "@orpc/server";
import {
	and,
	assignmentSubmissions,
	db,
	deliverables,
	eq,
	isNull,
	sql,
	tasks,
} from "@repo/database";
import { safeNotifySubscribers } from "../../notifications/lib/notification-service";
import type { ReviewSubmissionInput } from "../../studio/schemas/submission";
import { recordReviewActivity } from "./review-activity";
import {
	findScopedSubmission,
	getSubmissionParent,
	type ReviewActorContext,
} from "./review-transition-helpers";

const decisionStatus = {
	approve: "approved",
	request_revision: "revision_requested",
	reject: "rejected",
} as const;

const decisionWorkflowStatus = {
	approve: "approved",
	request_revision: "revision_requested",
	reject: "revision_requested",
} as const;

export async function decideSubmissionReview(
	context: ReviewActorContext,
	input: ReviewSubmissionInput,
) {
	const committed = await db.transaction(async (tx) => {
		const actionTime = new Date();
		const newStatus = decisionStatus[input.decision];
		const newWorkflowStatus = decisionWorkflowStatus[input.decision];
		const [decided] = await tx
			.update(assignmentSubmissions)
			.set({
				status: newStatus,
				reviewedAt: actionTime,
				reviewNote: input.reviewNote ?? null,
				updatedAt: actionTime,
			})
			.where(
				and(
					eq(assignmentSubmissions.id, input.id),
					eq(
						assignmentSubmissions.organizationId,
						context.organizationId,
					),
					eq(assignmentSubmissions.status, "in_review"),
					eq(assignmentSubmissions.reviewedBy, context.user.id),
				),
			)
			.returning({
				taskId: assignmentSubmissions.taskId,
				deliverableId: assignmentSubmissions.deliverableId,
				reviewClaimedAt: assignmentSubmissions.reviewClaimedAt,
			});

		if (!decided) {
			const existing = await findScopedSubmission(
				tx,
				context.organizationId,
				input.id,
			);
			if (!existing) {
				throw new ORPCError("NOT_FOUND", {
					message: "Submission not found",
				});
			}
			if (
				existing.status === "in_review" &&
				existing.reviewedBy !== context.user.id
			) {
				throw new ORPCError("CONFLICT", {
					message:
						"Submission is already being reviewed by another user",
				});
			}
			throw new ORPCError("CONFLICT", {
				message: "Submission review state changed before this decision",
			});
		}

		const parent = await getSubmissionParent(
			tx,
			context.organizationId,
			decided,
		);
		const parentUpdate =
			parent.type === "task"
				? await tx
						.update(tasks)
						.set({
							workflowStatus: newWorkflowStatus,
							completedAt:
								input.decision === "approve"
									? actionTime
									: null,
							updatedAt: actionTime,
							updatedBy: context.user.id,
						})
						.where(
							and(
								eq(tasks.id, parent.id),
								eq(
									tasks.organizationId,
									context.organizationId,
								),
								isNull(tasks.deletedAt),
								sql`${tasks.workflowStatus} IN ('submitted', 'in_review')`,
							),
						)
						.returning({ id: tasks.id })
				: await tx
						.update(deliverables)
						.set({
							workflowStatus: newWorkflowStatus,
							deliveredAt:
								input.decision === "approve"
									? actionTime
									: null,
							updatedAt: actionTime,
							updatedBy: context.user.id,
						})
						.where(
							and(
								eq(deliverables.id, parent.id),
								eq(
									deliverables.organizationId,
									context.organizationId,
								),
								isNull(deliverables.deletedAt),
								sql`${deliverables.workflowStatus} IN ('submitted', 'in_review')`,
							),
						)
						.returning({ id: deliverables.id });
		if (parentUpdate.length !== 1) {
			throw new ORPCError("CONFLICT", {
				message:
					"Submission parent workflow changed before this decision",
			});
		}

		await recordReviewActivity(tx, context, {
			submissionId: input.id,
			entityName: parent.name,
			parent,
			action:
				input.decision === "approve"
					? "approved"
					: input.decision === "reject"
						? "rejected"
						: "revision_requested",
			oldValue: "in_review",
			newValue: newStatus,
			metadata: {
				transition: "decision",
				decision: input.decision,
				reason: input.reviewNote ?? null,
				priorReviewerId: context.user.id,
				newReviewerId: context.user.id,
				claimTimestamp: decided.reviewClaimedAt?.toISOString() ?? null,
				actionTime: actionTime.toISOString(),
			},
		});
		return { id: input.id, newStatus, parent };
	});

	const notificationType = {
		approve: "review_approved",
		request_revision: "review_revision_requested",
		reject: "review_rejected",
	} as const;
	const titleOutcome = {
		approve: "approved",
		request_revision: "needs changes",
		reject: "rejected",
	} as const;
	await safeNotifySubscribers({
		organizationId: context.organizationId,
		entityType: committed.parent.type,
		entityId: committed.parent.id,
		entityName: committed.parent.name,
		type: notificationType[input.decision],
		title: `${committed.parent.type === "task" ? "Task" : "Deliverable"} ${titleOutcome[input.decision]}: ${committed.parent.name}`,
		body:
			input.decision === "request_revision"
				? `Changes requested by ${context.user.name}`
				: `${titleOutcome[input.decision][0]?.toUpperCase()}${titleOutcome[input.decision].slice(1)} by ${context.user.name}`,
		metadata: {
			outcome: committed.newStatus,
			reviewerName: context.user.name,
			reviewNote: input.reviewNote ?? null,
		},
		actorId: context.user.id,
		actorName: context.user.name,
		excludeUserId: context.user.id,
	});

	return committed;
}
