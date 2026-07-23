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
import { safeTrackActivity } from "../../activities/lib";
import { safeNotifySubscribers } from "../../notifications/lib/notification-service";
import { requirePermission } from "../../studio/lib/permissions";
import {
	updateTaskAssignmentStatusInputSchema,
	updateTaskAssignmentStatusOutputSchema,
} from "../../studio/schemas/task";
import {
	lockParentReviewEvidence,
	lockSubmissionParent,
	recomputeParentReviewAggregate,
} from "../../submissions/lib/parent-review-aggregate";

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
		await requirePermission(context, "task", "submit");

		const { id, status, note } = input;

		const task = await db.query.tasks.findFirst({
			where: and(
				eq(tasks.id, id),
				eq(tasks.organizationId, context.organizationId),
				isNull(tasks.deletedAt),
			),
			columns: { id: true, name: true, bookingId: true },
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

		const actionTime = new Date();
		const result = await db.transaction(async (tx) => {
			const parent = await lockSubmissionParent(
				tx,
				context.organizationId,
				{ id, type: "task" },
			);
			if (!parent) {
				throw new ORPCError("NOT_FOUND", { message: "Task not found" });
			}
			await lockParentReviewEvidence(tx, context.organizationId, parent);
			const assignment = await tx.query.taskAssignments.findFirst({
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
			if (
				assignment.progressStatus === status &&
				assignment.progressNote === (note ?? null)
			) {
				return { changed: false, oldStatus: assignment.progressStatus };
			}
			await tx
				.update(taskAssignments)
				.set({
					progressStatus: status,
					progressNote: note ?? null,
					startedAt:
						status === "in_progress"
							? (assignment.startedAt ?? actionTime)
							: assignment.startedAt,
					blockedAt: status === "blocked" ? actionTime : null,
					updatedAt: actionTime,
				})
				.where(eq(taskAssignments.id, assignment.id));
			await recomputeParentReviewAggregate(tx, context, parent, {
				actionTime,
				cause: "assignment_progress_changed",
			});
			return { changed: true, oldStatus: assignment.progressStatus };
		});

		if (!result.changed) {
			return {
				data: { id },
				message: `Task assignment already set to ${status}`,
			};
		}

		await safeTrackActivity(
			{ organizationId: context.organizationId, user: context.user },
			{
				entityType: "task",
				entityId: id,
				entityName: task.name,
				action: "assignment_progress_changed",
				field: "assignmentProgress",
				oldValue: result.oldStatus,
				newValue: status,
				parentEntityType: "booking",
				parentEntityId: task.bookingId,
				metadata: {
					crewId: crew.id,
					crewName: crew.name,
					...(note ? { note } : {}),
				},
			},
		);

		await safeNotifySubscribers({
			organizationId: context.organizationId,
			entityType: "task",
			entityId: id,
			entityName: task.name,
			type: "status_changed",
			title: `Task assignment progress updated: ${task.name}`,
			body: `${crew.name}: ${result.oldStatus} -> ${status}`,
			metadata: {
				changeScope: "assignment_progress",
				crewId: crew.id,
				crewName: crew.name,
				oldStatus: result.oldStatus,
				newStatus: status,
			},
			actorId: context.user.id,
			actorName: context.user.name,
			excludeUserId: context.user.id,
		});

		return {
			data: { id },
			message: `Task assignment updated to ${status}`,
		};
	});
