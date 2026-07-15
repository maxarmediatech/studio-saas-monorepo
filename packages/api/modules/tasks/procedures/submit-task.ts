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
import { safeNotifySubscribers } from "../../notifications/lib/notification-service";
import { requirePermission } from "../../studio/lib/permissions";
import {
	submitTaskInputSchema,
	submitTaskOutputSchema,
} from "../../studio/schemas/task";
import { persistWorkSubmission } from "../../submissions/lib/persist-work-submission";

export const submitTask = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/tasks/{taskId}/submissions",
		tags: ["Tasks"],
		summary: "Submit task for review",
		description: "Submit or resubmit work on a task for review",
	})
	.input(submitTaskInputSchema)
	.output(submitTaskOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "task", "submit");
		const { taskId, submissionNote, submissionLinks, files } = input;
		const task = await db.query.tasks.findFirst({
			where: and(
				eq(tasks.id, taskId),
				eq(tasks.organizationId, context.organizationId),
				isNull(tasks.deletedAt),
			),
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
		});
		if (!crew) {
			throw new ORPCError("FORBIDDEN", {
				message: "You must be a crew member to submit work",
			});
		}

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

		const saved = await persistWorkSubmission(context, {
			crew: { id: crew.id, name: crew.name },
			entity: { id: task.id, name: task.name, type: "task" },
			files,
			submissionLinks,
			submissionNote,
		});

		await safeNotifySubscribers({
			organizationId: context.organizationId,
			entityType: "task",
			entityId: task.id,
			entityName: task.name,
			type: "review_requested",
			title: `Task ${saved.wasResubmitted ? "resubmitted" : "submitted"} for review: ${task.name}`,
			body: `Submitted by ${crew.name}`,
			metadata: {
				submittedByName: crew.name,
			},
			actorId: context.user.id,
			actorName: context.user.name,
			excludeUserId: context.user.id,
		});

		return {
			data: { id: saved.id },
			message: saved.wasResubmitted
				? "Task resubmitted for review"
				: "Task submitted for review",
		};
	});
