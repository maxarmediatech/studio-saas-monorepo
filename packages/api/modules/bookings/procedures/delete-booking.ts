import { ORPCError } from "@orpc/server";
import { and, bookings, db, eq } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	deleteBookingInputSchema,
	deleteBookingOutputSchema,
} from "../../studio/schemas/booking";

export const deleteBooking = studioProtectedProcedure
	.route({
		method: "DELETE",
		path: "/bookings/{id}",
		tags: ["Bookings"],
		summary: "Delete booking",
		description: "Soft delete a booking (sets deletedAt timestamp)",
	})
	.input(deleteBookingInputSchema)
	.output(deleteBookingOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "booking", "delete");

		const { id } = input;

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

		// Check if already deleted
		if (existing.deletedAt) {
			throw new ORPCError("CONFLICT", {
				message: "Booking is already deleted",
			});
		}

		// Soft delete booking
		await db
			.update(bookings)
			.set({
				deletedAt: new Date(),
				deletedBy: context.user.id,
				updatedAt: new Date(),
				updatedBy: context.user.id,
			})
			.where(eq(bookings.id, id));

		return {
			data: { id },
			message: "Booking deleted successfully",
		};
	});
