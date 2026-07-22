import {
	and,
	asc,
	deliverables,
	deliverableTaskLinks,
	eq,
	isNull,
	tasks,
} from "@repo/database";
import { createActivityWithExecutor } from "../../activities/lib";
import type { TransactionClient } from "../../studio/lib/transactions";
import type { AggregateWorkflowStatus } from "../../submissions/lib/parent-review-state";
import type { ReviewActorContext } from "../../submissions/lib/review-transition-helpers";

export function deriveTaskBasedDeliverableStatus(
	statuses: AggregateWorkflowStatus[],
): AggregateWorkflowStatus {
	if (statuses.length === 0) {
		return "not_started";
	}
	if (statuses.every((status) => status === "approved")) {
		return "ready";
	}
	if (statuses.some((status) => status === "blocked")) {
		return "blocked";
	}
	if (statuses.some((status) => status === "revision_requested")) {
		return "revision_requested";
	}
	if (statuses.some((status) => status === "in_review")) {
		return "in_review";
	}
	if (
		statuses.some(
			(status) => status === "submitted" || status === "approved",
		)
	) {
		return "submitted";
	}
	if (statuses.some((status) => status === "in_progress")) {
		return "in_progress";
	}
	if (statuses.some((status) => status === "assigned")) {
		return "assigned";
	}
	return "not_started";
}

export async function switchDeliverableToDirectTracking(
	tx: TransactionClient,
	context: ReviewActorContext,
	deliverable: {
		id: string;
		name: string;
		workflowStatus: AggregateWorkflowStatus;
	},
	actionTime: Date,
): Promise<void> {
	await tx
		.update(deliverables)
		.set({
			trackingMode: "direct",
			workflowStatus: "not_started",
			completedAt: null,
			updatedAt: actionTime,
			updatedBy: context.user.id,
		})
		.where(eq(deliverables.id, deliverable.id));
	await createActivityWithExecutor(tx, {
		organizationId: context.organizationId,
		actorId: context.user.id,
		actorType: "user",
		actorName: context.user.name || "Unknown User",
		entityType: "deliverable",
		entityId: deliverable.id,
		entityName: deliverable.name,
		action: "workflow_changed",
		field: "workflowStatus",
		oldValue: deliverable.workflowStatus,
		newValue: "not_started",
		metadata: {
			transition: "last_required_task_removed",
			oldTrackingMode: "task_based",
			newTrackingMode: "direct",
		},
	});
}

export async function recomputeTaskBasedDeliverable(
	tx: TransactionClient,
	context: ReviewActorContext,
	deliverableId: string,
	actionTime: Date,
): Promise<void> {
	const [deliverable] = await tx
		.select({
			id: deliverables.id,
			name: deliverables.name,
			workflowStatus: deliverables.workflowStatus,
			completedAt: deliverables.completedAt,
			trackingMode: deliverables.trackingMode,
		})
		.from(deliverables)
		.where(
			and(
				eq(deliverables.id, deliverableId),
				eq(deliverables.organizationId, context.organizationId),
				isNull(deliverables.deletedAt),
			),
		)
		.for("update");
	if (!deliverable || deliverable.trackingMode !== "task_based") {
		return;
	}

	const requiredTasks = await tx
		.select({ workflowStatus: tasks.workflowStatus })
		.from(deliverableTaskLinks)
		.innerJoin(tasks, eq(deliverableTaskLinks.taskId, tasks.id))
		.where(
			and(
				eq(deliverableTaskLinks.deliverableId, deliverableId),
				eq(deliverableTaskLinks.kind, "required"),
				isNull(tasks.deletedAt),
			),
		)
		.orderBy(asc(tasks.id));
	const nextStatus = deriveTaskBasedDeliverableStatus(
		requiredTasks.map((task) => task.workflowStatus),
	);
	const nextCompletedAt =
		nextStatus === "ready" ? (deliverable.completedAt ?? actionTime) : null;
	if (
		nextStatus === deliverable.workflowStatus &&
		nextCompletedAt?.getTime() === deliverable.completedAt?.getTime()
	) {
		return;
	}

	await tx
		.update(deliverables)
		.set({
			workflowStatus: nextStatus,
			completedAt: nextCompletedAt,
			updatedAt: actionTime,
			updatedBy: context.user.id,
		})
		.where(eq(deliverables.id, deliverable.id));
	await createActivityWithExecutor(tx, {
		organizationId: context.organizationId,
		actorId: context.user.id,
		actorType: "user",
		actorName: context.user.name || "Unknown User",
		entityType: "deliverable",
		entityId: deliverable.id,
		entityName: deliverable.name,
		action: "workflow_changed",
		field: "workflowStatus",
		oldValue: deliverable.workflowStatus,
		newValue: nextStatus,
		metadata: { transition: "required_task_rollup" },
	});
}

export async function recomputeDeliverablesLinkedToTask(
	tx: TransactionClient,
	context: ReviewActorContext,
	taskId: string,
	actionTime: Date,
): Promise<void> {
	const links = await tx
		.select({ deliverableId: deliverableTaskLinks.deliverableId })
		.from(deliverableTaskLinks)
		.where(
			and(
				eq(deliverableTaskLinks.taskId, taskId),
				eq(deliverableTaskLinks.kind, "required"),
			),
		)
		.orderBy(asc(deliverableTaskLinks.deliverableId));
	for (const link of links) {
		await recomputeTaskBasedDeliverable(
			tx,
			context,
			link.deliverableId,
			actionTime,
		);
	}
}
