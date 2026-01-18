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
import { safeTrackAssignment } from "../../activities/lib";
import {
	safeAutoSubscribe,
	safeNotifySubscribers,
} from "../../notifications/lib/notification-service";
import { requirePermission } from "../../studio/lib/permissions";
import {
	assignCrewToTaskInputSchema,
	assignCrewToTaskOutputSchema,
} from "../../studio/schemas/task";

export const assignCrewToTask = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/tasks/{taskId}/assignments",
		tags: ["Tasks"],
		summary: "Assign crew to task",
		description: "Assign a crew member to a task",
	})
	.input(assignCrewToTaskInputSchema)
	.output(assignCrewToTaskOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "task", "assign");

		const { taskId, crewId } = input;

		// Verify task exists and belongs to organization
		const task = await db.query.tasks.findFirst({
			where: and(
				eq(tasks.id, taskId),
				eq(tasks.organizationId, context.organizationId),
				isNull(tasks.deletedAt),
			),
		});

		if (!task) {
			throw new ORPCError("NOT_FOUND", {
				message: "Task not found",
			});
		}

		// Verify crew exists and belongs to organization
		const crew = await db.query.crews.findFirst({
			where: and(
				eq(crews.id, crewId),
				eq(crews.organizationId, context.organizationId),
				isNull(crews.deletedAt),
			),
		});

		if (!crew) {
			throw new ORPCError("NOT_FOUND", {
				message: "Crew member not found",
			});
		}

		// Check if already assigned
		const existing = await db.query.taskAssignments.findFirst({
			where: and(
				eq(taskAssignments.taskId, taskId),
				eq(taskAssignments.crewId, crewId),
			),
		});

		if (existing) {
			throw new ORPCError("CONFLICT", {
				message: "Crew member is already assigned to this task",
			});
		}

		// Create assignment
		const [created] = await db
			.insert(taskAssignments)
			.values({
				taskId,
				crewId,
				assignedBy: context.user.id,
			})
			.returning({ id: taskAssignments.id });

		if (!created) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to assign crew",
			});
		}

		// Update task workflow status if first assignment
		if (task.workflowStatus === "not_started") {
			await db
				.update(tasks)
				.set({
					workflowStatus: "assigned",
					updatedAt: new Date(),
					updatedBy: context.user.id,
				})
				.where(eq(tasks.id, taskId));
		}

		// Track activity (non-blocking)
		// entityName = target of assignment (task), crewName in metadata
		await safeTrackAssignment(context, {
			entityType: "task_assignment",
			entityId: created.id,
			entityName: task.name,
			action: "assigned",
			parentEntityType: "task",
			parentEntityId: task.id,
			parentEntityName: task.name,
			metadata: { crewId: crew.id, crewName: crew.name },
		});

		if (crew.userId) {
			await safeAutoSubscribe({
				organizationId: context.organizationId,
				userId: crew.userId,
				entityType: "task",
				entityId: task.id,
			});
		}

		await safeNotifySubscribers({
			organizationId: context.organizationId,
			entityType: "task",
			entityId: task.id,
			entityName: task.name,
			type: "assigned",
			title: `Task assigned: ${task.name}`,
			body: `Assigned to ${crew.name}`,
			actorId: context.user.id,
			actorName: context.user.name,
			excludeUserId: context.user.id,
		});

		return {
			data: { id: created.id },
			message: `${crew.name} assigned to task`,
		};
	});
