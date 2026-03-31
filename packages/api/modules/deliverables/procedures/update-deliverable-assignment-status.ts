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
import { safeTrackStatusChange } from "../../activities/lib";
import { safeNotifySubscribers } from "../../notifications/lib/notification-service";
import { requirePermission } from "../../studio/lib/permissions";
import {
	updateDeliverableAssignmentStatusInputSchema,
	updateDeliverableAssignmentStatusOutputSchema,
} from "../../studio/schemas/deliverable";

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
			columns: { id: true, name: true, status: true, bookingId: true },
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

		const assignment = await db.query.deliverableAssignments.findFirst({
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

		if (deliverable.status === status) {
			return {
				data: { id },
				message: `Deliverable status already set to ${status}`,
			};
		}

		await db
			.update(deliverables)
			.set({
				status,
				updatedAt: new Date(),
				updatedBy: context.user.id,
			})
			.where(eq(deliverables.id, id));

		await safeTrackStatusChange(
			{ organizationId: context.organizationId, user: context.user },
			{
				entityType: "deliverable",
				entityId: id,
				entityName: deliverable.name,
				oldStatus: deliverable.status,
				newStatus: status,
				parentEntityType: "booking",
				parentEntityId: deliverable.bookingId,
				metadata: note ? { note } : undefined,
			},
		);

		await safeNotifySubscribers({
			organizationId: context.organizationId,
			entityType: "deliverable",
			entityId: id,
			entityName: deliverable.name,
			type: "status_changed",
			title: `Deliverable status updated: ${deliverable.name}`,
			body: `${deliverable.status} -> ${status}`,
			metadata: {
				oldStatus: deliverable.status,
				newStatus: status,
			},
			actorId: context.user.id,
			actorName: context.user.name,
			excludeUserId: context.user.id,
		});

		return {
			data: { id },
			message: `Deliverable status updated to ${status}`,
		};
	});
