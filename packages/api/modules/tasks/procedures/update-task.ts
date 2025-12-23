import { ORPCError } from "@orpc/server";
import { and, eq, tasks, db } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	updateTaskInputSchema,
	updateTaskOutputSchema,
} from "../../studio/schemas/task";

export const updateTask = studioProtectedProcedure
	.route({
		method: "PUT",
		path: "/tasks/{id}",
		tags: ["Tasks"],
		summary: "Update task",
		description: "Update an existing task",
	})
	.input(updateTaskInputSchema)
	.output(updateTaskOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "task", "update");

		const {
			id,
			name,
			description,
			status,
			priority,
			dueDate,
			metadata,
		} = input;

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

		// Build update object
		const updates: Partial<typeof tasks.$inferInsert> = {
			updatedAt: new Date(),
			updatedBy: context.user.id,
		};

		if (name !== undefined) updates.name = name;
		if (description !== undefined) updates.description = description;
		if (status !== undefined) updates.status = status;
		if (priority !== undefined) updates.priority = priority;
		if (dueDate !== undefined) updates.dueDate = dueDate;
		if (metadata !== undefined) updates.metadata = metadata;

		await db.update(tasks).set(updates).where(eq(tasks.id, id));

		return {
			data: { id },
			message: "Task updated successfully",
		};
	});
