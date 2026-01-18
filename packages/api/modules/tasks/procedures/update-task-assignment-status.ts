import { ORPCError } from "@orpc/server";
import {
	and,
	crews,
	db,
	eq,
	isNull,
	taskAssignments,
	tasks,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { safeTrackStatusChange } from "../../activities/lib";
import { safeNotifySubscribers } from "../../notifications/lib/notification-service";
import { requirePermission } from "../../studio/lib/permissions";
import {
	updateTaskAssignmentStatusInputSchema,
	updateTaskAssignmentStatusOutputSchema,
} from "../../studio/schemas/task";

export const updateTaskAssignmentStatus = studioProtectedProcedure
	.route({
		method: "PUT",
		path: "/tasks/{id}/assignment-status",
		tags: ["Tasks"],
		summary: "Update assigned task status",
		description: "Update status for an assigned task (assignee workflow)",
	})
	.input(updateTaskAssignmentStatusInputSchema)
	.output(updateTaskAssignmentStatusOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "task", "submit");

		const { id, status, note } = input;

		const task = await db.query.tasks.findFirst({
			where: and(
				eq(tasks.id, id),
				eq(tasks.organizationId, context.organizationId),
				isNull(tasks.deletedAt),
			),
			columns: { id: true, name: true, status: true, bookingId: true },
		});

		if (!task) {
			throw new ORPCError("NOT_FOUND", { message: "Task not found" });
		}

		const crew = await db.query.crews.findFirst({
			where: and(
				eq(crews.organizationId, context.organizationId),
				eq(crews.userId, context.user.id),
				isNull(crews.deletedAt),
			),
			columns: { id: true, name: true },
		});

		if (!crew) {
			throw new ORPCError("FORBIDDEN", {
				message: "You must be a crew member to update status",
			});
		}

		const assignment = await db.query.taskAssignments.findFirst({
			where: and(
				eq(taskAssignments.taskId, id),
				eq(taskAssignments.crewId, crew.id),
			),
		});

		if (!assignment) {
			throw new ORPCError("FORBIDDEN", {
				message: "You are not assigned to this task",
			});
		}

		if (task.status === status) {
			return {
				data: { id },
				message: `Task status already set to ${status}`,
			};
		}

		await db
			.update(tasks)
			.set({
				status,
				updatedAt: new Date(),
				updatedBy: context.user.id,
			})
			.where(eq(tasks.id, id));

		await safeTrackStatusChange(
			{ organizationId: context.organizationId, user: context.user },
			{
				entityType: "task",
				entityId: id,
				entityName: task.name,
				oldStatus: task.status,
				newStatus: status,
				parentEntityType: "booking",
				parentEntityId: task.bookingId,
				metadata: note ? { note } : undefined,
			},
		);

		await safeNotifySubscribers({
			organizationId: context.organizationId,
			entityType: "task",
			entityId: id,
			entityName: task.name,
			type: "status_changed",
			title: `Task status updated: ${task.name}`,
			body: `${task.status} -> ${status}`,
			actorId: context.user.id,
			actorName: context.user.name,
			excludeUserId: context.user.id,
		});

		return {
			data: { id },
			message: `Task status updated to ${status}`,
		};
	});
