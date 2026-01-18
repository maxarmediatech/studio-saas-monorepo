import { ORPCError } from "@orpc/server";
import { and, db, eq, tasks } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { safeNotifySubscribers } from "../../notifications/lib/notification-service";
import { requirePermission } from "../../studio/lib/permissions";
import {
	updateTaskStatusInputSchema,
	updateTaskStatusOutputSchema,
} from "../../studio/schemas/task";

export const updateTaskStatus = studioProtectedProcedure
	.route({
		method: "PUT",
		path: "/tasks/{id}/status",
		tags: ["Tasks"],
		summary: "Update task status",
		description: "Update the status of a task",
	})
	.input(updateTaskStatusInputSchema)
	.output(updateTaskStatusOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "task", "update");

		const { id, status } = input;

		// Verify task exists and belongs to organization
		const existing = await db.query.tasks.findFirst({
			where: and(
				eq(tasks.id, id),
				eq(tasks.organizationId, context.organizationId),
			),
		});

		if (!existing) {
			throw new ORPCError("NOT_FOUND", {
				message: "Task not found",
			});
		}

		if (existing.deletedAt) {
			throw new ORPCError("CONFLICT", {
				message: "Cannot update status of deleted task",
			});
		}

		// Update status
		await db
			.update(tasks)
			.set({
				status,
				updatedAt: new Date(),
				updatedBy: context.user.id,
			})
			.where(eq(tasks.id, id));

		await safeNotifySubscribers({
			organizationId: context.organizationId,
			entityType: "task",
			entityId: id,
			entityName: existing.name,
			type: "status_changed",
			title: `Task status updated: ${existing.name}`,
			body: `${existing.status} -> ${status}`,
			actorId: context.user.id,
			actorName: context.user.name,
			excludeUserId: context.user.id,
		});

		return {
			data: { id },
			message: `Task status updated to ${status}`,
		};
	});
