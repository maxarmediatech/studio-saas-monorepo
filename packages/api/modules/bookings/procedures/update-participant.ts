import { ORPCError } from "@orpc/server";
import {
	and,
	bookingParticipants,
	bookings,
	db,
	eq,
	isNull,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	updateParticipantInputSchema,
	updateParticipantOutputSchema,
} from "../../studio/schemas/booking";

export const updateParticipant = studioProtectedProcedure
	.route({
		method: "PUT",
		path: "/bookings/{bookingId}/participants/{participantId}",
		tags: ["Bookings", "Participants"],
		summary: "Update participant role",
		description: "Update the role of an existing participant in a booking",
	})
	.input(updateParticipantInputSchema)
	.output(updateParticipantOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "booking", "update");

		const { bookingId, participantId, role } = input;

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
			columns: { id: true, clientId: true },
		});

		if (!participant) {
			throw new ORPCError("NOT_FOUND", {
				message: "Participant not found",
			});
		}

		// Check if this client+role combination already exists (different participant)
		const existingWithRole = await db.query.bookingParticipants.findFirst({
			where: and(
				eq(bookingParticipants.bookingId, bookingId),
				eq(bookingParticipants.clientId, participant.clientId),
				eq(bookingParticipants.role, role),
			),
			columns: { id: true },
		});

		if (existingWithRole && existingWithRole.id !== participantId) {
			throw new ORPCError("CONFLICT", {
				message: `This client already has the role "${role}" for this booking`,
			});
		}

		// Update the participant role
		await db
			.update(bookingParticipants)
			.set({
				role,
				updatedAt: new Date(),
			})
			.where(eq(bookingParticipants.id, participantId));

		return {
			data: { id: participantId },
			message: "Participant role updated",
		};
	});
