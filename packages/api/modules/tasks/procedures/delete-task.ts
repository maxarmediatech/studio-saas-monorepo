import { ORPCError } from "@orpc/server";
import { and, db, eq, tasks } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
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
		requirePermission(context, "task", "delete");

		const { id } = input;

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

		// Check if already deleted
		if (existing.deletedAt) {
			throw new ORPCError("CONFLICT", {
				message: "Task is already deleted",
			});
		}

		// Soft delete task
		await db
			.update(tasks)
			.set({
				deletedAt: new Date(),
				deletedBy: context.user.id,
				updatedAt: new Date(),
				updatedBy: context.user.id,
			})
			.where(eq(tasks.id, id));

		return {
			data: { id },
			message: "Task deleted successfully",
		};
	});
