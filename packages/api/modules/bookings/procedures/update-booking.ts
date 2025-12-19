import { ORPCError } from "@orpc/server";
import { and, eq, bookings, db } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	updateBookingInputSchema,
	updateBookingOutputSchema,
} from "../../studio/schemas/booking";

export const updateBooking = studioProtectedProcedure
	.route({
		method: "PUT",
		path: "/bookings/{id}",
		tags: ["Bookings"],
		summary: "Update booking",
		description: "Update an existing booking's basic information",
	})
	.input(updateBookingInputSchema)
	.output(updateBookingOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "booking", "update");

		const { id, name, bookingType, packageType, packageCost, note } = input;

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

		// Build update object
		const updates: Partial<typeof bookings.$inferInsert> = {
			updatedAt: new Date(),
			updatedBy: context.user.id,
		};

		if (name !== undefined) updates.name = name;
		if (bookingType !== undefined) updates.bookingType = bookingType;
		if (packageType !== undefined) updates.packageType = packageType;
		if (packageCost !== undefined) updates.packageCost = packageCost;
		if (note !== undefined) updates.note = note;

		await db.update(bookings).set(updates).where(eq(bookings.id, id));

		return {
			data: { id },
			message: "Booking updated successfully",
		};
	});
