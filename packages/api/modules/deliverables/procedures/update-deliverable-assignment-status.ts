import { ORPCError } from "@orpc/server";
import {
	and,
	crews,
	db,
	deliverableAssignments,
	deliverables,
	eq,
	isNull,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { safeTrackActivity } from "../../activities/lib";
import { safeNotifySubscribers } from "../../notifications/lib/notification-service";
import { requirePermission } from "../../studio/lib/permissions";
import {
	updateDeliverableAssignmentStatusInputSchema,
	updateDeliverableAssignmentStatusOutputSchema,
} from "../../studio/schemas/deliverable";
import {
	lockParentReviewEvidence,
	lockSubmissionParent,
	recomputeParentReviewAggregate,
} from "../../submissions/lib/parent-review-aggregate";

export const updateDeliverableAssignmentStatus = studioProtectedProcedure
	.route({
		method: "PUT",
		path: "/deliverables/{id}/assignment-status",
		tags: ["Deliverables"],
		summary: "Update assigned deliverable status",
		description:
			"Update status for an assigned deliverable (assignee workflow)",
	})
	.input(updateDeliverableAssignmentStatusInputSchema)
	.output(updateDeliverableAssignmentStatusOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "deliverable", "submit");

		const { id, status, note } = input;

		const deliverable = await db.query.deliverables.findFirst({
			where: and(
				eq(deliverables.id, id),
				eq(deliverables.organizationId, context.organizationId),
				isNull(deliverables.deletedAt),
			),
			columns: { id: true, name: true, bookingId: true },
		});

		if (!deliverable) {
			throw new ORPCError("NOT_FOUND", {
				message: "Deliverable not found",
			});
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
				{ id, type: "deliverable" },
			);
			if (!parent) {
				throw new ORPCError("NOT_FOUND", {
					message: "Deliverable not found",
				});
			}
			if (parent.trackingMode === "task_based") {
				throw new ORPCError("CONFLICT", {
					message:
						"Update progress on linked tasks for task-based deliverables",
				});
			}
			await lockParentReviewEvidence(tx, context.organizationId, parent);
			const assignment = await tx.query.deliverableAssignments.findFirst({
				where: and(
					eq(deliverableAssignments.deliverableId, id),
					eq(deliverableAssignments.crewId, crew.id),
				),
			});
			if (!assignment) {
				throw new ORPCError("FORBIDDEN", {
					message: "You are not assigned to this deliverable",
				});
			}
			if (
				assignment.progressStatus === status &&
				assignment.progressNote === (note ?? null)
			) {
				return { changed: false, oldStatus: assignment.progressStatus };
			}
			await tx
				.update(deliverableAssignments)
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
				.where(eq(deliverableAssignments.id, assignment.id));
			await recomputeParentReviewAggregate(tx, context, parent, {
				actionTime,
				cause: "assignment_progress_changed",
			});
			return { changed: true, oldStatus: assignment.progressStatus };
		});

		if (!result.changed) {
			return {
				data: { id },
				message: `Deliverable assignment already set to ${status}`,
			};
		}

		await safeTrackActivity(
			{ organizationId: context.organizationId, user: context.user },
			{
				entityType: "deliverable",
				entityId: id,
				entityName: deliverable.name,
				action: "assignment_progress_changed",
				field: "assignmentProgress",
				oldValue: result.oldStatus,
				newValue: status,
				parentEntityType: "booking",
				parentEntityId: deliverable.bookingId,
				metadata: {
					crewId: crew.id,
					crewName: crew.name,
					...(note ? { note } : {}),
				},
			},
		);

		await safeNotifySubscribers({
			organizationId: context.organizationId,
			entityType: "deliverable",
			entityId: id,
			entityName: deliverable.name,
			type: "status_changed",
			title: `Deliverable assignment progress updated: ${deliverable.name}`,
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
			message: `Deliverable assignment updated to ${status}`,
		};
	});
