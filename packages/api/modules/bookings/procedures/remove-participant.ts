import { ORPCError } from "@orpc/server";
import { and, eq, isNull, count, bookings, bookingParticipants, db } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	removeParticipantInputSchema,
	removeParticipantOutputSchema,
} from "../../studio/schemas/booking";

export const removeParticipant = studioProtectedProcedure
	.route({
		method: "DELETE",
		path: "/bookings/{bookingId}/participants/{participantId}",
		tags: ["Bookings", "Participants"],
		summary: "Remove participant from booking",
		description: "Remove a participant from a booking. Requires at least one participant to remain.",
	})
	.input(removeParticipantInputSchema)
	.output(removeParticipantOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "booking", "update");

		const { bookingId, participantId } = input;

		// Verify booking exists and belongs to organization
		const booking = await db.query.bookings.findFirst({
			where: and(
				eq(bookings.id, bookingId),
				eq(bookings.organizationId, context.organizationId),
				isNull(bookings.deletedAt),
			),
			columns: { id: true },
		});

		if (!booking) {
			throw new ORPCError("NOT_FOUND", {
				message: "Booking not found",
			});
		}

		// Verify participant exists and belongs to this booking
		const participant = await db.query.bookingParticipants.findFirst({
			where: and(
				eq(bookingParticipants.id, participantId),
				eq(bookingParticipants.bookingId, bookingId),
			),
			with: {
				client: {
					columns: { name: true },
				},
			},
		});

		if (!participant) {
			throw new ORPCError("NOT_FOUND", {
				message: "Participant not found",
			});
		}

		// Check if this is the last participant
		const [participantCount] = await db
			.select({ count: count().mapWith(Number) })
			.from(bookingParticipants)
			.where(eq(bookingParticipants.bookingId, bookingId));

		if (participantCount && participantCount.count <= 1) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Cannot remove the last participant. A booking must have at least one participant.",
			});
		}

		// Remove the participant
		await db
			.delete(bookingParticipants)
			.where(eq(bookingParticipants.id, participantId));

		return {
			data: { id: participantId },
			message: `${participant.client?.name || "Participant"} removed from booking`,
		};
	});
