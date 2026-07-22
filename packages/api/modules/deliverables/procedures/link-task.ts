import { ORPCError } from "@orpc/server";
import {
	and,
	assignmentSubmissions,
	db,
	deliverableAssignments,
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
	linkTaskToDeliverableInputSchema,
	linkTaskToDeliverableOutputSchema,
} from "../../studio/schemas/deliverable";
import {
	recomputeTaskBasedDeliverable,
	switchDeliverableToDirectTracking,
} from "../lib/task-rollup";

export const linkTaskToDeliverable = studioProtectedProcedure
	.route({
		method: "PUT",
		path: "/deliverables/{deliverableId}/tasks/{taskId}",
		tags: ["Deliverables"],
		summary: "Link task to deliverable",
		description:
			"Create or update a same-booking task link. Required links drive deliverable workflow.",
	})
	.input(linkTaskToDeliverableInputSchema)
	.output(linkTaskToDeliverableOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "deliverable", "update");
		await requirePermission(context, "task", "read");
		const actionTime = new Date();

		const result = await db.transaction(async (tx) => {
			// Global lock order: task first, then deliverable. Task fanout uses the
			// same order and locks multiple deliverables by ID.
			const [task] = await tx
				.select({
					id: tasks.id,
					name: tasks.name,
					bookingId: tasks.bookingId,
				})
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
					message: !task ? "Task not found" : "Deliverable not found",
				});
			}
			if (task.bookingId !== deliverable.bookingId) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Task and deliverable must belong to the same booking",
				});
			}

			if (
				input.kind === "required" &&
				deliverable.trackingMode === "direct"
			) {
				const [assignment, submission] = await Promise.all([
					tx.query.deliverableAssignments.findFirst({
						where: eq(
							deliverableAssignments.deliverableId,
							deliverable.id,
						),
						columns: { id: true },
					}),
					tx.query.assignmentSubmissions.findFirst({
						where: eq(
							assignmentSubmissions.deliverableId,
							deliverable.id,
						),
						columns: { id: true },
					}),
				]);
				if (assignment || submission) {
					throw new ORPCError("CONFLICT", {
						message:
							"Remove direct deliverable assignments and submissions before adding a required task",
					});
				}
				await tx
					.update(deliverables)
					.set({
						trackingMode: "task_based",
						updatedAt: actionTime,
						updatedBy: context.user.id,
					})
					.where(eq(deliverables.id, deliverable.id));
			}

			const [link] = await tx
				.insert(deliverableTaskLinks)
				.values({
					organizationId: context.organizationId,
					bookingId: deliverable.bookingId,
					deliverableId: deliverable.id,
					taskId: task.id,
					kind: input.kind,
					createdBy: context.user.id,
				})
				.onConflictDoUpdate({
					target: [
						deliverableTaskLinks.deliverableId,
						deliverableTaskLinks.taskId,
					],
					set: { kind: input.kind },
				})
				.returning({ id: deliverableTaskLinks.id });
			if (!link) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Failed to link task",
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
			return { linkId: link.id, deliverable, task };
		});

		await safeTrackActivity(context, {
			entityType: "deliverable",
			entityId: result.deliverable.id,
			entityName: result.deliverable.name,
			action: "task_linked",
			parentEntityType: "booking",
			parentEntityId: result.deliverable.bookingId,
			metadata: {
				taskId: result.task.id,
				taskName: result.task.name,
				kind: input.kind,
			},
		});
		return {
			data: { id: result.linkId },
			message: "Task linked to deliverable",
		};
	});
