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
	linkTaskToDeliverableInputSchema,
	linkTaskToDeliverableOutputSchema,
} from "../../studio/schemas/deliverable";

export const linkTaskToDeliverable = studioProtectedProcedure
	.route({
		method: "PUT",
		path: "/deliverables/{deliverableId}/tasks/{taskId}",
		tags: ["Deliverables"],
		summary: "Link task to deliverable",
		description:
			"Create an informational same-booking task link without changing either workflow",
	})
	.input(linkTaskToDeliverableInputSchema)
	.output(linkTaskToDeliverableOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "deliverable", "update");
		await requirePermission(context, "task", "read");

		const result = await db.transaction(async (tx) => {
			const task = await tx.query.tasks.findFirst({
				where: and(
					eq(tasks.id, input.taskId),
					eq(tasks.organizationId, context.organizationId),
					isNull(tasks.deletedAt),
				),
				columns: { id: true, name: true, bookingId: true },
			});
			const deliverable = await tx.query.deliverables.findFirst({
				where: and(
					eq(deliverables.id, input.deliverableId),
					eq(deliverables.organizationId, context.organizationId),
					isNull(deliverables.deletedAt),
				),
				columns: { id: true, name: true, bookingId: true },
			});
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

			const [link] = await tx
				.insert(deliverableTaskLinks)
				.values({
					organizationId: context.organizationId,
					bookingId: deliverable.bookingId,
					deliverableId: deliverable.id,
					taskId: task.id,
					kind: "reference",
					createdBy: context.user.id,
				})
				.onConflictDoNothing()
				.returning({ id: deliverableTaskLinks.id });
			if (!link) {
				throw new ORPCError("CONFLICT", {
					message: "Task is already linked to this deliverable",
				});
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
				kind: "reference",
			},
		});
		return {
			data: { id: result.linkId },
			message: "Task linked to deliverable",
		};
	});
