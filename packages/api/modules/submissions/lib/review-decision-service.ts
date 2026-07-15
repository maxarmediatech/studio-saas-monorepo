import { ORPCError } from "@orpc/server";
import { and, assignmentSubmissions, db, eq } from "@repo/database";
import { safeNotifySubscribers } from "../../notifications/lib/notification-service";
import type { ReviewSubmissionInput } from "../../studio/schemas/submission";
import {
	lockParentReviewEvidence,
	lockSubmissionParent,
	recomputeParentReviewAggregate,
} from "./parent-review-aggregate";
import { recordReviewActivity } from "./review-activity";
import {
	findScopedSubmission,
	type ReviewActorContext,
} from "./review-transition-helpers";

const decisionStatus = {
	approve: "approved",
	request_revision: "revision_requested",
	reject: "rejected",
} as const;

export async function decideSubmissionReview(
	context: ReviewActorContext,
	input: ReviewSubmissionInput,
) {
	const committed = await db.transaction(async (tx) => {
		const actionTime = new Date();
		const newStatus = decisionStatus[input.decision];
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
		const parentRef =
			existing.taskId && !existing.deliverableId
				? { id: existing.taskId, type: "task" as const }
				: existing.deliverableId && !existing.taskId
					? {
							id: existing.deliverableId,
							type: "deliverable" as const,
						}
					: null;
		if (!parentRef) {
			throw new ORPCError("CONFLICT", {
				message: "Submission parent relationship is invalid",
			});
		}
		const parent = await lockSubmissionParent(
			tx,
			context.organizationId,
			parentRef,
		);
		if (!parent) {
			throw new ORPCError("CONFLICT", {
				message:
					"Submission parent is no longer available in this organization",
			});
		}
		await lockParentReviewEvidence(tx, context.organizationId, parent);
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
			const current = await findScopedSubmission(
				tx,
				context.organizationId,
				input.id,
			);
			if (!current) {
				throw new ORPCError("NOT_FOUND", {
					message: "Submission not found",
				});
			}
			if (
				current.status === "in_review" &&
				current.reviewedBy !== context.user.id
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
		const parentTransition = await recomputeParentReviewAggregate(
			tx,
			context,
			parent,
			{ actionTime, cause: "decision" },
		);
		return { id: input.id, newStatus, parent, parentTransition };
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
