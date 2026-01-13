import { ORPCError } from "@orpc/server";
import {
	and,
	assignmentSubmissions,
	crews,
	db,
	eq,
	isNull,
	sql,
	taskAssignments,
	tasks,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { safeTrackActivity } from "../../activities/lib";
import { requirePermission } from "../../studio/lib/permissions";
import {
	submitTaskInputSchema,
	submitTaskOutputSchema,
} from "../../studio/schemas/task";

export const submitTask = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/tasks/{taskId}/submissions",
		tags: ["Tasks"],
		summary: "Submit task for review",
		description: "Submit work on a task for review",
	})
	.input(submitTaskInputSchema)
	.output(submitTaskOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "task", "submit");

		const { taskId, submissionNote } = input;

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

		// Find crew member for the current user
		const crew = await db.query.crews.findFirst({
			where: and(
				eq(crews.organizationId, context.organizationId),
				eq(crews.userId, context.user.id),
				isNull(crews.deletedAt),
			),
		});

		if (!crew) {
			throw new ORPCError("FORBIDDEN", {
				message: "You must be a crew member to submit work",
			});
		}

		// Verify user is assigned to this task
		const assignment = await db.query.taskAssignments.findFirst({
			where: and(
				eq(taskAssignments.taskId, taskId),
				eq(taskAssignments.crewId, crew.id),
			),
		});

		if (!assignment) {
			throw new ORPCError("FORBIDDEN", {
				message: "You are not assigned to this task",
			});
		}

		// Check for existing active submission
		const existingSubmission =
			await db.query.assignmentSubmissions.findFirst({
				where: and(
					eq(assignmentSubmissions.taskId, taskId),
					eq(assignmentSubmissions.submittedBy, crew.id),
					sql`${assignmentSubmissions.status} IN ('submitted', 'in_review')`,
				),
			});

		if (existingSubmission) {
			throw new ORPCError("CONFLICT", {
				message: "You already have a pending submission for this task",
			});
		}

		// Create submission
		const [created] = await db
			.insert(assignmentSubmissions)
			.values({
				organizationId: context.organizationId,
				taskId,
				submittedBy: crew.id,
				status: "submitted",
				submissionNote: submissionNote ?? null,
				submittedAt: new Date(),
			})
			.returning({ id: assignmentSubmissions.id });

		if (!created) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create submission",
			});
		}

		// Update task workflow status
		await db
			.update(tasks)
			.set({
				workflowStatus: "submitted",
				updatedAt: new Date(),
				updatedBy: context.user.id,
			})
			.where(eq(tasks.id, taskId));

		// Track activity (non-blocking)
		await safeTrackActivity(context, {
			entityType: "submission",
			entityId: created.id,
			entityName: task.name,
			action: "submitted",
			parentEntityType: "task",
			parentEntityId: task.id,
			parentEntityName: task.name,
			metadata: { crewId: crew.id, crewName: crew.name },
		});

		return {
			data: { id: created.id },
			message: "Task submitted for review",
		};
	});
