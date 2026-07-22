import { ORPCError } from "@orpc/server";
import {
	and,
	db,
	deliverables,
	deliverableTaskLinks,
	eq,
	isNull,
	tasks,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { safeTrackActivity } from "../../activities/lib";
import { requirePermission } from "../../studio/lib/permissions";
import {
	unlinkTaskFromDeliverableInputSchema,
	unlinkTaskFromDeliverableOutputSchema,
} from "../../studio/schemas/deliverable";
import {
	recomputeTaskBasedDeliverable,
	switchDeliverableToDirectTracking,
} from "../lib/task-rollup";

export const unlinkTaskFromDeliverable = studioProtectedProcedure
	.route({
		method: "DELETE",
		path: "/deliverables/{deliverableId}/tasks/{taskId}",
		tags: ["Deliverables"],
		summary: "Unlink task from deliverable",
	})
	.input(unlinkTaskFromDeliverableInputSchema)
	.output(unlinkTaskFromDeliverableOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "deliverable", "update");
		const actionTime = new Date();
		const result = await db.transaction(async (tx) => {
			const [task] = await tx
				.select({ id: tasks.id, name: tasks.name })
				.from(tasks)
				.where(
					and(
						eq(tasks.id, input.taskId),
						eq(tasks.organizationId, context.organizationId),
						isNull(tasks.deletedAt),
					),
				)
				.for("update");
			const [deliverable] = await tx
				.select({
					id: deliverables.id,
					name: deliverables.name,
					bookingId: deliverables.bookingId,
					trackingMode: deliverables.trackingMode,
					workflowStatus: deliverables.workflowStatus,
				})
				.from(deliverables)
				.where(
					and(
						eq(deliverables.id, input.deliverableId),
						eq(deliverables.organizationId, context.organizationId),
						isNull(deliverables.deletedAt),
					),
				)
				.for("update");
			if (!task || !deliverable) {
				throw new ORPCError("NOT_FOUND", {
					message: !task
						? "Task link not found"
						: "Deliverable not found",
				});
			}
			const removed = await tx
				.delete(deliverableTaskLinks)
				.where(
					and(
						eq(
							deliverableTaskLinks.organizationId,
							context.organizationId,
						),
						eq(deliverableTaskLinks.deliverableId, deliverable.id),
						eq(deliverableTaskLinks.taskId, task.id),
					),
				)
				.returning({ id: deliverableTaskLinks.id });
			if (removed.length === 0) {
				throw new ORPCError("NOT_FOUND", {
					message: "Task link not found",
				});
			}

			const requiredLink = await tx.query.deliverableTaskLinks.findFirst({
				where: and(
					eq(deliverableTaskLinks.deliverableId, deliverable.id),
					eq(deliverableTaskLinks.kind, "required"),
				),
				columns: { id: true },
			});
			if (!requiredLink && deliverable.trackingMode === "task_based") {
				await switchDeliverableToDirectTracking(
					tx,
					context,
					deliverable,
					actionTime,
				);
			} else {
				await recomputeTaskBasedDeliverable(
					tx,
					context,
					deliverable.id,
					actionTime,
				);
			}
			return { deliverable, task };
		});

		await safeTrackActivity(context, {
			entityType: "deliverable",
			entityId: result.deliverable.id,
			entityName: result.deliverable.name,
			action: "task_unlinked",
			parentEntityType: "booking",
			parentEntityId: result.deliverable.bookingId,
			metadata: { taskId: result.task.id, taskName: result.task.name },
		});
		return {
			data: { id: result.deliverable.id },
			message: "Task unlinked from deliverable",
		};
	});
