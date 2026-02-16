import { ORPCError } from "@orpc/server";
import {
	and,
	calendarSyncJobs,
	db,
	eq,
	shootCalendarEvents,
	shoots,
} from "@repo/database";
import { logger } from "@repo/logs";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { safeTrackActivity } from "../../activities/lib";
import { getCalendarDeleteJobType } from "../calendar-sync";
import { requirePermission } from "../../studio/lib/permissions";
import {
	deleteShootInputSchema,
	deleteShootOutputSchema,
} from "../../studio/schemas/shoot";

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

		// Soft delete shoot
		await db
			.update(shoots)
			.set({
				deletedAt: new Date(),
				deletedBy: context.user.id,
				updatedAt: new Date(),
				updatedBy: context.user.id,
			})
			.where(eq(shoots.id, id));

		// Calendar side-effects (non-blocking): remove/cancel existing events.
		try {
			const mappings = await db
				.select({
					crewId: shootCalendarEvents.crewId,
					deliveryMethod: shootCalendarEvents.deliveryMethod,
				})
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

			if (mappings.length > 0) {
				await db.insert(calendarSyncJobs).values(
					mappings.map((mapping) => ({
						organizationId: context.organizationId,
						status: "pending" as const,
						jobType: getCalendarDeleteJobType(
							mapping.deliveryMethod,
						),
						shootId: id,
						crewId: mapping.crewId,
						updatedAt: new Date(),
					})),
				);
			}
		} catch (error) {
			logger.error("Failed to enqueue calendar jobs on shoot delete", {
				shootId: id,
				error: error instanceof Error ? error.message : String(error),
			});
		}

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
