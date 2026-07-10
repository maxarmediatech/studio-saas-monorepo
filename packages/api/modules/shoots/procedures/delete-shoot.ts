import { ORPCError } from "@orpc/server";
import { and, db, eq, shootCalendarEvents, shoots } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { safeTrackActivity } from "../../activities/lib";
import { requirePermission } from "../../studio/lib/permissions";
import {
	deleteShootInputSchema,
	deleteShootOutputSchema,
} from "../../studio/schemas/shoot";
import { enqueueCalendarCancellation } from "../lib/calendar-delivery";

export const deleteShoot = studioProtectedProcedure
	.route({
		method: "DELETE",
		path: "/shoots/{id}",
		tags: ["Shoots"],
		summary: "Delete shoot",
		description: "Soft delete a shoot (sets deletedAt timestamp)",
	})
	.input(deleteShootInputSchema)
	.output(deleteShootOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "shoot", "delete");

		const { id } = input;

		// Verify shoot exists and belongs to organization (include booking for activity context)
		const existing = await db.query.shoots.findFirst({
			where: and(
				eq(shoots.id, id),
				eq(shoots.organizationId, context.organizationId),
			),
			with: {
				booking: {
					columns: { id: true, name: true },
				},
			},
		});

		if (!existing) {
			throw new ORPCError("NOT_FOUND", {
				message: "Shoot not found",
			});
		}

		// Check if already deleted
		if (existing.deletedAt) {
			throw new ORPCError("CONFLICT", {
				message: "Shoot is already deleted",
			});
		}

		await db.transaction(async (tx) => {
			const mappings = await tx
				.select({ crewId: shootCalendarEvents.crewId })
				.from(shootCalendarEvents)
				.where(
					and(
						eq(
							shootCalendarEvents.organizationId,
							context.organizationId,
						),
						eq(shootCalendarEvents.shootId, id),
					),
				);

			for (const mapping of mappings) {
				await enqueueCalendarCancellation(tx, {
					organizationId: context.organizationId,
					shootId: id,
					crewId: mapping.crewId,
				});
			}

			await tx
				.update(shoots)
				.set({
					deletedAt: new Date(),
					deletedBy: context.user.id,
					updatedAt: new Date(),
					updatedBy: context.user.id,
				})
				.where(
					and(
						eq(shoots.id, id),
						eq(shoots.organizationId, context.organizationId),
					),
				);
		});

		// Track activity (non-blocking)
		await safeTrackActivity(
			{ organizationId: context.organizationId, user: context.user },
			{
				entityType: "shoot",
				entityId: id,
				entityName: existing.name,
				action: "deleted",
				parentEntityType: "booking",
				parentEntityId: existing.bookingId,
				parentEntityName: existing.booking.name,
			},
		);

		return {
			data: { id },
			message: "Shoot deleted successfully",
		};
	});
