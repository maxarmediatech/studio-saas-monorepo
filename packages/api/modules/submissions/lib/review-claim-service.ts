import { ORPCError } from "@orpc/server";
import {
	and,
	assignmentSubmissions,
	db,
	eq,
	lte,
	members,
	users,
} from "@repo/database";
import type { TransactionClient } from "../../studio/lib/transactions";
import {
	type LockedSubmissionParent,
	lockParentReviewEvidence,
	lockSubmissionParent,
	recomputeParentReviewAggregate,
} from "./parent-review-aggregate";
import { recordReviewActivity } from "./review-activity";
import { REVIEW_CLAIM_STALE_AFTER_MS } from "./review-claim-policy";
import {
	findScopedSubmission,
	type ReviewActorContext,
	type SubmissionRelationship,
} from "./review-transition-helpers";

async function lockTransitionParent(
	tx: TransactionClient,
	context: ReviewActorContext,
	submission: SubmissionRelationship,
): Promise<LockedSubmissionParent> {
	const parentRef =
		submission.taskId && !submission.deliverableId
			? { id: submission.taskId, type: "task" as const }
			: submission.deliverableId && !submission.taskId
				? {
						id: submission.deliverableId,
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
	return parent;
}

export async function claimSubmissionForReview(
	context: ReviewActorContext,
	id: string,
) {
	return db.transaction(async (tx) => {
		const actionTime = new Date();
		const existing = await findScopedSubmission(
			tx,
			context.organizationId,
			id,
		);
		if (!existing) {
			throw new ORPCError("NOT_FOUND", {
				message: "Submission not found",
			});
		}
		const parent = await lockTransitionParent(tx, context, existing);
		const [claimed] = await tx
			.update(assignmentSubmissions)
			.set({
				status: "in_review",
				reviewedBy: context.user.id,
				reviewClaimedAt: actionTime,
				reviewedAt: null,
				reviewNote: null,
				updatedAt: actionTime,
			})
			.where(
				and(
					eq(assignmentSubmissions.id, id),
					eq(
						assignmentSubmissions.organizationId,
						context.organizationId,
					),
					eq(assignmentSubmissions.status, "submitted"),
				),
			)
			.returning({
				id: assignmentSubmissions.id,
				taskId: assignmentSubmissions.taskId,
				deliverableId: assignmentSubmissions.deliverableId,
			});

		if (!claimed) {
			const current = await findScopedSubmission(
				tx,
				context.organizationId,
				id,
			);
			if (!current) {
				throw new ORPCError("NOT_FOUND", {
					message: "Submission not found",
				});
			}
			if (
				current.status === "in_review" &&
				current.reviewedBy === context.user.id
			) {
				return { alreadyClaimed: true, id };
			}
			if (current.status === "in_review") {
				throw new ORPCError("CONFLICT", {
					message:
						"Submission is already being reviewed by another user",
				});
			}
			throw new ORPCError("BAD_REQUEST", {
				message: "Only submitted work can be claimed for review",
			});
		}

		await recordReviewActivity(tx, context, {
			submissionId: id,
			entityName: parent.name,
			parent,
			action: "status_changed",
			oldValue: "submitted",
			newValue: "in_review",
			metadata: {
				transition: "claim",
				reason: "Reviewer claimed submission",
				priorReviewerId: null,
				newReviewerId: context.user.id,
				claimTimestamp: actionTime.toISOString(),
				actionTime: actionTime.toISOString(),
			},
		});
		await recomputeParentReviewAggregate(tx, context, parent, {
			actionTime,
			cause: "claim",
		});

		return { alreadyClaimed: false, id };
	});
}

export async function releaseSubmissionReview(
	context: ReviewActorContext,
	input: { id: string; reason: string },
) {
	return db.transaction(async (tx) => {
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
		const parent = await lockTransitionParent(tx, context, existing);
		if (
			existing.status !== "in_review" ||
			existing.reviewedBy !== context.user.id ||
			!existing.reviewClaimedAt
		) {
			throw new ORPCError("CONFLICT", {
				message:
					existing.status === "in_review"
						? "Only the assigned reviewer can release this claim"
						: "Submission review claim has already changed",
			});
		}

		const actionTime = new Date();
		const [released] = await tx
			.update(assignmentSubmissions)
			.set({
				status: "submitted",
				reviewedBy: null,
				reviewClaimedAt: null,
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
					eq(
						assignmentSubmissions.reviewClaimedAt,
						existing.reviewClaimedAt,
					),
				),
			)
			.returning({
				taskId: assignmentSubmissions.taskId,
				deliverableId: assignmentSubmissions.deliverableId,
			});
		if (!released) {
			throw new ORPCError("CONFLICT", {
				message:
					"Submission review claim changed before it could be released",
			});
		}

		await recordReviewActivity(tx, context, {
			submissionId: input.id,
			entityName: parent.name,
			parent,
			action: "status_changed",
			oldValue: "in_review",
			newValue: "submitted",
			metadata: {
				transition: "release",
				reason: input.reason,
				priorReviewerId: context.user.id,
				newReviewerId: null,
				claimTimestamp: existing.reviewClaimedAt.toISOString(),
				actionTime: actionTime.toISOString(),
			},
		});
		await recomputeParentReviewAggregate(tx, context, parent, {
			actionTime,
			cause: "release",
		});
		return { id: input.id };
	});
}

async function getStaleClaim(
	tx: TransactionClient,
	organizationId: string,
	id: string,
	cutoff: Date,
): Promise<{
	deliverableId: string | null;
	id: string;
	reviewClaimedAt: Date;
	reviewedBy: string;
	status: "in_review";
	taskId: string | null;
}> {
	const existing = await findScopedSubmission(tx, organizationId, id);
	if (!existing) {
		throw new ORPCError("NOT_FOUND", { message: "Submission not found" });
	}
	if (
		existing.status !== "in_review" ||
		!existing.reviewedBy ||
		!existing.reviewClaimedAt
	) {
		throw new ORPCError("CONFLICT", {
			message: "Submission does not have an active review claim",
		});
	}
	if (existing.reviewClaimedAt > cutoff) {
		throw new ORPCError("BAD_REQUEST", {
			message:
				"Review claim is not stale yet; active claims never expire automatically",
		});
	}
	return {
		deliverableId: existing.deliverableId,
		id: existing.id,
		reviewClaimedAt: existing.reviewClaimedAt,
		reviewedBy: existing.reviewedBy,
		status: "in_review",
		taskId: existing.taskId,
	};
}

export async function administrativelyReleaseReview(
	context: ReviewActorContext,
	input: { id: string; reason: string },
) {
	return db.transaction(async (tx) => {
		const actionTime = new Date();
		const cutoff = new Date(
			actionTime.getTime() - REVIEW_CLAIM_STALE_AFTER_MS,
		);
		const existing = await getStaleClaim(
			tx,
			context.organizationId,
			input.id,
			cutoff,
		);
		const parent = await lockTransitionParent(tx, context, existing);
		const [released] = await tx
			.update(assignmentSubmissions)
			.set({
				status: "submitted",
				reviewedBy: null,
				reviewClaimedAt: null,
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
					eq(assignmentSubmissions.reviewedBy, existing.reviewedBy),
					eq(
						assignmentSubmissions.reviewClaimedAt,
						existing.reviewClaimedAt,
					),
					lte(assignmentSubmissions.reviewClaimedAt, cutoff),
				),
			)
			.returning({
				taskId: assignmentSubmissions.taskId,
				deliverableId: assignmentSubmissions.deliverableId,
			});
		if (!released) {
			throw new ORPCError("CONFLICT", {
				message: "Review claim changed before it could be released",
			});
		}
		await recordReviewActivity(tx, context, {
			submissionId: input.id,
			entityName: parent.name,
			parent,
			action: "status_changed",
			oldValue: "in_review",
			newValue: "submitted",
			metadata: {
				transition: "admin_release",
				overrideBasis: "stale_claim",
				reason: input.reason,
				priorReviewerId: existing.reviewedBy,
				newReviewerId: null,
				claimTimestamp: existing.reviewClaimedAt.toISOString(),
				actionTime: actionTime.toISOString(),
			},
		});
		await recomputeParentReviewAggregate(tx, context, parent, {
			actionTime,
			cause: "admin_release",
		});
		return { id: input.id };
	});
}

export async function administrativelyReassignReview(
	context: ReviewActorContext,
	input: { id: string; reason: string; reviewerId: string },
) {
	return db.transaction(async (tx) => {
		const actionTime = new Date();
		const cutoff = new Date(
			actionTime.getTime() - REVIEW_CLAIM_STALE_AFTER_MS,
		);
		const existing = await getStaleClaim(
			tx,
			context.organizationId,
			input.id,
			cutoff,
		);
		const parent = await lockTransitionParent(tx, context, existing);
		if (existing.reviewedBy === input.reviewerId) {
			return { alreadyAssigned: true, id: input.id };
		}

		const [reviewer] = await tx
			.select({ id: users.id, name: users.name })
			.from(members)
			.innerJoin(users, eq(members.userId, users.id))
			.where(
				and(
					eq(members.organizationId, context.organizationId),
					eq(members.userId, input.reviewerId),
				),
			)
			.limit(1);
		if (!reviewer) {
			throw new ORPCError("BAD_REQUEST", {
				message: "New reviewer must be an active organization member",
			});
		}

		const [reassigned] = await tx
			.update(assignmentSubmissions)
			.set({
				reviewedBy: reviewer.id,
				reviewClaimedAt: actionTime,
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
					eq(assignmentSubmissions.reviewedBy, existing.reviewedBy),
					eq(
						assignmentSubmissions.reviewClaimedAt,
						existing.reviewClaimedAt,
					),
					lte(assignmentSubmissions.reviewClaimedAt, cutoff),
				),
			)
			.returning({
				taskId: assignmentSubmissions.taskId,
				deliverableId: assignmentSubmissions.deliverableId,
			});
		if (!reassigned) {
			throw new ORPCError("CONFLICT", {
				message: "Review claim changed before it could be reassigned",
			});
		}

		await recordReviewActivity(tx, context, {
			submissionId: input.id,
			entityName: parent.name,
			parent,
			action: "assigned",
			oldIdentifier: existing.reviewedBy,
			newIdentifier: reviewer.id,
			metadata: {
				transition: "admin_reassign",
				overrideBasis: "stale_claim",
				reason: input.reason,
				priorReviewerId: existing.reviewedBy,
				newReviewerId: reviewer.id,
				newReviewerName: reviewer.name,
				claimTimestamp: existing.reviewClaimedAt.toISOString(),
				newClaimTimestamp: actionTime.toISOString(),
				actionTime: actionTime.toISOString(),
			},
		});
		return { alreadyAssigned: false, id: input.id };
	});
}
