import { ORPCError } from "@orpc/server";
import { and, crews, db, eq, shootCalendarEvents } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { safeTrackActivity } from "../../activities/lib";
import { enqueueCalendarCancellation } from "../../shoots/lib/calendar-delivery";
import { requirePermission } from "../../studio/lib/permissions";
import {
	deleteCrewInputSchema,
	deleteCrewOutputSchema,
} from "../../studio/schemas/crew";

export const deleteCrew = studioProtectedProcedure
	.route({
		method: "DELETE",
		path: "/crews/{id}",
		tags: ["Crews"],
		summary: "Delete crew",
		description: "Soft delete a crew member (sets deletedAt timestamp)",
	})
	.input(deleteCrewInputSchema)
	.output(deleteCrewOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "crew", "delete");

		const { id } = input;

		// Verify crew exists and belongs to organization
		const existing = await db.query.crews.findFirst({
			where: and(
				eq(crews.id, id),
				eq(crews.organizationId, context.organizationId),
			),
		});

		if (!existing) {
			throw new ORPCError("NOT_FOUND", {
				message: "Crew member not found",
			});
		}

		// Check if already deleted
		if (existing.deletedAt) {
			throw new ORPCError("CONFLICT", {
				message: "Crew member is already deleted",
			});
		}

		await db.transaction(async (tx) => {
			const mappings = await tx
				.select({ shootId: shootCalendarEvents.shootId })
				.from(shootCalendarEvents)
				.where(
					and(
						eq(
							shootCalendarEvents.organizationId,
							context.organizationId,
						),
						eq(shootCalendarEvents.crewId, id),
					),
				);
			for (const mapping of mappings) {
				await enqueueCalendarCancellation(tx, {
					organizationId: context.organizationId,
					shootId: mapping.shootId,
					crewId: id,
				});
			}
			await tx
				.update(crews)
				.set({
					deletedAt: new Date(),
					deletedBy: context.user.id,
					updatedAt: new Date(),
					updatedBy: context.user.id,
				})
				.where(
					and(
						eq(crews.id, id),
						eq(crews.organizationId, context.organizationId),
					),
				);
		});

		// Track activity (non-blocking)
		await safeTrackActivity(context, {
			entityType: "crew",
			entityId: id,
			entityName: existing.name,
			action: "deleted",
		});

		return {
			data: { id },
			message: "Crew member deleted successfully",
		};
	});
