import { ORPCError } from "@orpc/server";
import { and, db, deliverables, eq, isNull } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { safeTrackActivity } from "../../activities/lib";
import { requirePermission } from "../../studio/lib/permissions";
import {
	deleteDeliverableInputSchema,
	deleteDeliverableOutputSchema,
} from "../../studio/schemas/deliverable";

export const deleteDeliverable = studioProtectedProcedure
	.route({
		method: "DELETE",
		path: "/deliverables/{id}",
		tags: ["Deliverables"],
		summary: "Delete deliverable",
		description: "Soft delete a deliverable",
	})
	.input(deleteDeliverableInputSchema)
	.output(deleteDeliverableOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "deliverable", "delete");

		const { id } = input;

		// Verify deliverable exists and belongs to organization (include booking for activity context)
		const deliverable = await db.query.deliverables.findFirst({
			where: and(
				eq(deliverables.id, id),
				eq(deliverables.organizationId, context.organizationId),
				isNull(deliverables.deletedAt),
			),
			with: {
				booking: {
					columns: { id: true, name: true },
				},
			},
		});

		if (!deliverable) {
			throw new ORPCError("NOT_FOUND", {
				message: "Deliverable not found",
			});
		}

		// Soft delete
		await db
			.update(deliverables)
			.set({
				deletedAt: new Date(),
				deletedBy: context.user.id,
				updatedAt: new Date(),
				updatedBy: context.user.id,
			})
			.where(eq(deliverables.id, id));

		// Track activity (non-blocking)
		await safeTrackActivity(
			{ organizationId: context.organizationId, user: context.user },
			{
				entityType: "deliverable",
				entityId: id,
				entityName: deliverable.name,
				action: "deleted",
				parentEntityType: "booking",
				parentEntityId: deliverable.bookingId,
				parentEntityName: deliverable.booking.name,
			},
		);

		return {
			data: { id },
			message: "Deliverable deleted successfully",
		};
	});
