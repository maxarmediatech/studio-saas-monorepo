import { ORPCError } from "@orpc/server";
import { and, db, deliverables, eq, isNull } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { safeTrackActivity } from "../../activities/lib";
import { requirePermission } from "../../studio/lib/permissions";
import {
	setDeliverableDeliveryInputSchema,
	setDeliverableDeliveryOutputSchema,
} from "../../studio/schemas/deliverable";

export const setDeliverableDelivery = studioProtectedProcedure
	.route({
		method: "PUT",
		path: "/deliverables/{id}/delivery",
		tags: ["Deliverables"],
		summary: "Set client delivery timestamp",
		description:
			"Mark a completed deliverable as delivered to the client, or clear the delivery timestamp.",
	})
	.input(setDeliverableDeliveryInputSchema)
	.output(setDeliverableDeliveryOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "deliverable", "update");
		const actionTime = new Date();
		const deliveredAt =
			input.deliveredAt === null
				? null
				: input.deliveredAt
					? new Date(input.deliveredAt)
					: new Date();
		if (
			deliveredAt &&
			deliveredAt.getTime() > actionTime.getTime() + 5 * 60 * 1000
		) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Delivery time cannot be in the future",
			});
		}
		const deliverable = await db.transaction(async (tx) => {
			const [lockedDeliverable] = await tx
				.select({
					id: deliverables.id,
					name: deliverables.name,
					bookingId: deliverables.bookingId,
					workflowStatus: deliverables.workflowStatus,
					completedAt: deliverables.completedAt,
					deliveredAt: deliverables.deliveredAt,
				})
				.from(deliverables)
				.where(
					and(
						eq(deliverables.id, input.id),
						eq(deliverables.organizationId, context.organizationId),
						isNull(deliverables.deletedAt),
					),
				)
				.for("update");
			if (!lockedDeliverable) {
				throw new ORPCError("NOT_FOUND", {
					message: "Deliverable not found",
				});
			}
			if (
				deliveredAt &&
				(!lockedDeliverable.completedAt ||
					(lockedDeliverable.workflowStatus !== "approved" &&
						lockedDeliverable.workflowStatus !== "ready"))
			) {
				throw new ORPCError("CONFLICT", {
					message:
						"Deliverable must be internally complete before delivery",
				});
			}

			await tx
				.update(deliverables)
				.set({
					deliveredAt,
					updatedAt: actionTime,
					updatedBy: context.user.id,
				})
				.where(eq(deliverables.id, lockedDeliverable.id));
			return lockedDeliverable;
		});
		await safeTrackActivity(context, {
			entityType: "deliverable",
			entityId: deliverable.id,
			entityName: deliverable.name,
			action: deliveredAt ? "delivered" : "delivery_cleared",
			parentEntityType: "booking",
			parentEntityId: deliverable.bookingId,
			metadata: {
				oldDeliveredAt: deliverable.deliveredAt?.toISOString() ?? null,
				deliveredAt: deliveredAt?.toISOString() ?? null,
			},
		});
		return {
			data: { id: deliverable.id },
			message: deliveredAt
				? "Deliverable marked as delivered"
				: "Delivery timestamp cleared",
		};
	});
