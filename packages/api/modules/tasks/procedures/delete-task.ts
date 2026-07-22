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
	deleteTaskInputSchema,
	deleteTaskOutputSchema,
} from "../../studio/schemas/task";

export const deleteTask = studioProtectedProcedure
	.route({
		method: "DELETE",
		path: "/tasks/{id}",
		tags: ["Tasks"],
		summary: "Delete task",
		description: "Soft delete a task (sets deletedAt timestamp)",
	})
	.input(deleteTaskInputSchema)
	.output(deleteTaskOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "task", "delete");

		const { id } = input;

		const deletedTask = await db.transaction(async (tx) => {
			const [lockedTask] = await tx
				.select({
					id: tasks.id,
					name: tasks.name,
					bookingId: tasks.bookingId,
					deletedAt: tasks.deletedAt,
				})
				.from(tasks)
				.where(
					and(
						eq(tasks.id, id),
						eq(tasks.organizationId, context.organizationId),
					),
				)
				.for("update");
			if (!lockedTask) {
				throw new ORPCError("NOT_FOUND", {
					message: "Task not found",
				});
			}
			if (lockedTask.deletedAt) {
				throw new ORPCError("CONFLICT", {
					message: "Task is already deleted",
				});
			}
			const [requiredActiveLink] = await tx
				.select({ id: deliverableTaskLinks.id })
				.from(deliverableTaskLinks)
				.innerJoin(
					deliverables,
					eq(deliverableTaskLinks.deliverableId, deliverables.id),
				)
				.where(
					and(
						eq(deliverableTaskLinks.taskId, id),
						eq(
							deliverableTaskLinks.organizationId,
							context.organizationId,
						),
						eq(deliverableTaskLinks.kind, "required"),
						isNull(deliverables.deletedAt),
					),
				)
				.limit(1);
			if (requiredActiveLink) {
				throw new ORPCError("CONFLICT", {
					message:
						"Remove required deliverable links before deleting this task",
				});
			}
			const actionTime = new Date();
			// Optional/reference links and links to deleted deliverables do not own
			// task lifecycle. Remove them so soft deletion cannot leave hidden links.
			await tx
				.delete(deliverableTaskLinks)
				.where(
					and(
						eq(deliverableTaskLinks.taskId, id),
						eq(
							deliverableTaskLinks.organizationId,
							context.organizationId,
						),
					),
				);
			await tx
				.update(tasks)
				.set({
					deletedAt: actionTime,
					deletedBy: context.user.id,
					updatedAt: actionTime,
					updatedBy: context.user.id,
				})
				.where(eq(tasks.id, id));
			return lockedTask;
		});

		// Track activity (non-blocking)
		await safeTrackActivity(
			{ organizationId: context.organizationId, user: context.user },
			{
				entityType: "task",
				entityId: id,
				entityName: deletedTask.name,
				action: "deleted",
				parentEntityType: "booking",
				parentEntityId: deletedTask.bookingId,
			},
		);

		return {
			data: { id },
			message: "Task deleted successfully",
		};
	});
