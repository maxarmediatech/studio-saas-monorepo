import { hasAnyRole } from "@repo/auth/lib/permissions";
import {
	and,
	db,
	deliverables,
	eq,
	isNull,
	members,
	tasks,
	users,
} from "@repo/database";
import { createActivityWithExecutor } from "../../activities/lib";
import {
	lockParentReviewEvidence,
	lockSubmissionParent,
	readParentReviewProjection,
} from "./parent-review-aggregate";
import { queryParentReviewMismatches } from "./parent-review-reconciliation-report";
import type { ReviewActorContext } from "./review-transition-helpers";

export type {
	ParentReviewMismatch,
	ParentReviewReconciliationReport,
} from "./parent-review-reconciliation-report";
export { queryParentReviewMismatches } from "./parent-review-reconciliation-report";

async function getReviewedRepairActor(
	organizationId: string,
	userId: string,
): Promise<ReviewActorContext> {
	const [actor] = await db
		.select({
			id: users.id,
			name: users.name,
			email: users.email,
			role: members.role,
		})
		.from(members)
		.innerJoin(users, eq(users.id, members.userId))
		.where(
			and(
				eq(members.organizationId, organizationId),
				eq(members.userId, userId),
			),
		)
		.limit(1);
	if (!actor || !hasAnyRole(actor.role, ["owner", "admin"])) {
		throw new Error(
			"Reviewed parent repair requires an owner or admin in the organization",
		);
	}
	return {
		organizationId,
		user: { id: actor.id, name: actor.name, email: actor.email },
	};
}

export async function repairReviewedParentReviewMismatches(input: {
	organizationId: string;
	reviewedReportHash: string;
	reviewedByUserId: string;
}) {
	const before = await queryParentReviewMismatches(input.organizationId);
	if (before.reportHash !== input.reviewedReportHash) {
		throw new Error(
			"Current parent review report does not match the reviewed report hash",
		);
	}
	const actor = await getReviewedRepairActor(
		input.organizationId,
		input.reviewedByUserId,
	);
	const applied: string[] = [];
	const skipped: Array<{ parentId: string; reason: string }> = [];
	for (const mismatch of before.mismatches) {
		if (!mismatch.repairable) {
			skipped.push({
				parentId: mismatch.parentId,
				reason: mismatch.reason.includes("approval_evidence_incomplete")
					? "approval_evidence_incomplete"
					: mismatch.reason.includes(
								"approval_timestamp_precedes_evidence",
							)
						? "approval_timestamp_precedes_evidence"
						: "approval_transition_time_unavailable",
			});
			continue;
		}
		const repaired = await db.transaction(async (tx) => {
			const parent = await lockSubmissionParent(
				tx,
				input.organizationId,
				{ id: mismatch.parentId, type: mismatch.parentType },
			);
			if (!parent) {
				return false;
			}
			if (
				parent.workflowStatus !== mismatch.actualStatus ||
				(parent.completedAt?.toISOString() ?? null) !==
					mismatch.actualApprovalTime
			) {
				return false;
			}
			await lockParentReviewEvidence(tx, input.organizationId, parent);
			const projection = await readParentReviewProjection(
				tx,
				input.organizationId,
				parent,
			);
			if (
				projection.workflowStatus !== mismatch.expectedStatus ||
				projection.workflowStatus === "approved"
			) {
				return false;
			}
			const actionTime = new Date();
			let update: Array<{ id: string }>;
			if (parent.type === "task") {
				update = await tx
					.update(tasks)
					.set({
						workflowStatus: projection.workflowStatus,
						completedAt: null,
						updatedAt: actionTime,
						updatedBy: actor.user.id,
					})
					.where(
						and(
							eq(tasks.id, parent.id),
							eq(tasks.organizationId, input.organizationId),
							isNull(tasks.deletedAt),
							eq(tasks.workflowStatus, parent.workflowStatus),
						),
					)
					.returning({ id: tasks.id });
			} else {
				update = await tx
					.update(deliverables)
					.set({
						workflowStatus: projection.workflowStatus,
						deliveredAt: null,
						updatedAt: actionTime,
						updatedBy: actor.user.id,
					})
					.where(
						and(
							eq(deliverables.id, parent.id),
							eq(
								deliverables.organizationId,
								input.organizationId,
							),
							isNull(deliverables.deletedAt),
							eq(
								deliverables.workflowStatus,
								parent.workflowStatus,
							),
						),
					)
					.returning({ id: deliverables.id });
			}
			if (update.length !== 1) {
				return false;
			}
			await createActivityWithExecutor(tx, {
				organizationId: input.organizationId,
				actorId: actor.user.id,
				actorType: "user",
				actorName: actor.user.name || "Unknown User",
				entityType: parent.type,
				entityId: parent.id,
				entityName: parent.name,
				action:
					parent.workflowStatus === projection.workflowStatus
						? "updated"
						: "workflow_changed",
				field:
					parent.workflowStatus === projection.workflowStatus
						? parent.type === "task"
							? "completedAt"
							: "deliveredAt"
						: "workflowStatus",
				oldValue:
					parent.workflowStatus === projection.workflowStatus
						? parent.completedAt?.toISOString()
						: parent.workflowStatus,
				newValue:
					parent.workflowStatus === projection.workflowStatus
						? undefined
						: projection.workflowStatus,
				metadata: {
					transition: "reviewed_submission_aggregate_repair",
					reviewedReportHash: input.reviewedReportHash,
					approvalTime: null,
				},
			});
			return true;
		});
		if (repaired) {
			applied.push(mismatch.parentId);
		} else {
			skipped.push({
				parentId: mismatch.parentId,
				reason: "evidence_changed_after_report",
			});
		}
	}
	return {
		before,
		applied,
		skipped,
		after: await queryParentReviewMismatches(input.organizationId),
	};
}
