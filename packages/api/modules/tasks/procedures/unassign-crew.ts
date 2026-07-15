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
import { requirePermission } from "../../studio/lib/permissions";
import {
	unassignCrewFromTaskInputSchema,
	unassignCrewFromTaskOutputSchema,
} from "../../studio/schemas/task";
import {
	lockParentReviewEvidence,
	lockSubmissionParent,
	recomputeParentReviewAggregate,
} from "../../submissions/lib/parent-review-aggregate";

export const unassignCrewFromTask = studioProtectedProcedure
	.route({
		method: "DELETE",
		path: "/tasks/{taskId}/assignments/{crewId}",
		tags: ["Tasks"],
		summary: "Unassign crew from task",
		description: "Remove a crew member's assignment from a task",
	})
	.input(unassignCrewFromTaskInputSchema)
	.output(unassignCrewFromTaskOutputSchema)
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

		// Find the assignment
		const assignment = await db.query.taskAssignments.findFirst({
			where: and(
				eq(taskAssignments.taskId, taskId),
				eq(taskAssignments.crewId, crewId),
			),
		});

		if (!assignment) {
			throw new ORPCError("NOT_FOUND", {
				message: "Assignment not found",
			});
		}

		// Get crew info for activity tracking
		const crew = await db.query.crews.findFirst({
			where: eq(crews.id, crewId),
			columns: { id: true, name: true },
		});

		const removed = await db.transaction(async (tx) => {
			const parent = await lockSubmissionParent(
				tx,
				context.organizationId,
				{ id: taskId, type: "task" },
			);
			if (!parent) {
				throw new ORPCError("NOT_FOUND", { message: "Task not found" });
			}
			await lockParentReviewEvidence(tx, context.organizationId, parent);
			const current = await tx.query.taskAssignments.findFirst({
				where: and(
					eq(taskAssignments.taskId, taskId),
					eq(taskAssignments.crewId, crewId),
				),
				columns: { id: true },
			});
			if (!current) {
				throw new ORPCError("NOT_FOUND", {
					message: "Assignment not found",
				});
			}
			await tx
				.delete(taskAssignments)
				.where(eq(taskAssignments.id, current.id));
			await recomputeParentReviewAggregate(tx, context, parent, {
				actionTime: new Date(),
				cause: "assignment_removed",
			});
			return current;
		});

		// Track activity (non-blocking)
		// entityName = target of assignment (task), crewName in metadata
		if (crew) {
			await safeTrackAssignment(context, {
				entityType: "task_assignment",
				entityId: removed.id,
				entityName: task.name,
				action: "unassigned",
				parentEntityType: "task",
				parentEntityId: task.id,
				parentEntityName: task.name,
				metadata: { crewId: crew.id, crewName: crew.name },
			});
		}

		return {
			data: { id: removed.id },
			message: "Crew member unassigned from task",
		};
	});
