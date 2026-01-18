import { ORPCError } from "@orpc/server";
import { and, db, eq, tasks } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	detectChanges,
	safeTrackFieldChanges,
	safeTrackStatusChange,
} from "../../activities/lib";
import { safeNotifySubscribers } from "../../notifications/lib/notification-service";
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
		await requirePermission(context, "task", "update");

		const { id, name, description, status, priority, dueDate, metadata } =
			input;

		// Verify task exists and belongs to organization
		const existing = await db.query.tasks.findFirst({
			where: and(
				eq(tasks.id, id),
				eq(tasks.organizationId, context.organizationId),
			),
			with: {
				booking: {
					columns: { id: true, name: true },
				},
			},
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

		if (name !== undefined) {
			updates.name = name;
		}
		if (description !== undefined) {
			updates.description = description;
		}
		if (status !== undefined) {
			updates.status = status;
		}
		if (priority !== undefined) {
			updates.priority = priority;
		}
		if (dueDate !== undefined) {
			updates.dueDate = dueDate;
		}
		if (metadata !== undefined) {
			updates.metadata = metadata;
		}

		await db.update(tasks).set(updates).where(eq(tasks.id, id));

		// Track status change separately (non-blocking)
		if (status !== undefined && status !== existing.status) {
			await safeTrackStatusChange(
				{ organizationId: context.organizationId, user: context.user },
				{
					entityType: "task",
					entityId: id,
					entityName: name ?? existing.name,
					oldStatus: existing.status,
					newStatus: status,
					parentEntityType: "booking",
					parentEntityId: existing.bookingId,
					parentEntityName: existing.booking.name,
				},
			);

			await safeNotifySubscribers({
				organizationId: context.organizationId,
				entityType: "task",
				entityId: id,
				entityName: name ?? existing.name,
				type: "status_changed",
				title: `Task status updated: ${name ?? existing.name}`,
				body: `${existing.status} -> ${status}`,
				actorId: context.user.id,
				actorName: context.user.name,
				excludeUserId: context.user.id,
			});
		}

		// Track other field changes (non-blocking)
		const changes = detectChanges(
			existing,
			{ name, description, priority, dueDate },
			["name", "description", "priority", "dueDate"],
		);

		if (changes.length > 0) {
			await safeTrackFieldChanges(
				{ organizationId: context.organizationId, user: context.user },
				{
					entityType: "task",
					entityId: id,
					entityName: name ?? existing.name,
					parentEntityType: "booking",
					parentEntityId: existing.bookingId,
					parentEntityName: existing.booking.name,
					changes,
				},
			);
		}

		return {
			data: { id },
			message: "Task updated successfully",
		};
	});
