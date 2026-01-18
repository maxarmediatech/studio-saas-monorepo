import { ORPCError } from "@orpc/server";
import { and, bookings, db, eq } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { safeTrackStatusChange } from "../../activities/lib";
import { requirePermission } from "../../studio/lib/permissions";
import {
	updateBookingStatusInputSchema,
	updateBookingStatusOutputSchema,
} from "../../studio/schemas/booking";

export const updateBookingStatus = studioProtectedProcedure
	.route({
		method: "PUT",
		path: "/bookings/{id}/status",
		tags: ["Bookings"],
		summary: "Update booking status",
		description: "Update a booking's phase/status",
	})
	.input(updateBookingStatusInputSchema)
	.output(updateBookingStatusOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "booking", "update");

		const { id, status } = input;

		// Verify booking exists and belongs to organization
		const existing = await db.query.bookings.findFirst({
			where: and(
				eq(bookings.id, id),
				eq(bookings.organizationId, context.organizationId),
			),
		});

		if (!existing) {
			throw new ORPCError("NOT_FOUND", {
				message: "Booking not found",
			});
		}

		// Check if deleted
		if (existing.deletedAt) {
			throw new ORPCError("CONFLICT", {
				message: "Cannot update status of a deleted booking",
			});
		}

		// Skip if no change
		if (existing.status === status) {
			return {
				data: { id },
				message: "No status change needed",
			};
		}

		// Update status
		await db
			.update(bookings)
			.set({
				status,
				updatedAt: new Date(),
				updatedBy: context.user.id,
			})
			.where(eq(bookings.id, id));

		// Track activity (non-blocking)
		await safeTrackStatusChange(
			{ organizationId: context.organizationId, user: context.user },
			{
				entityType: "booking",
				entityId: id,
				entityName: existing.name,
				oldStatus: existing.status,
				newStatus: status,
			},
		);

		return {
			data: { id },
			message: `Booking status updated to '${status}'`,
		};
	});
