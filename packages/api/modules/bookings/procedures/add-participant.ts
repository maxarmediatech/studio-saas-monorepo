import { ORPCError } from "@orpc/server";
import { and, eq, isNull, bookings, bookingParticipants, clients, db } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	addParticipantInputSchema,
	addParticipantOutputSchema,
} from "../../studio/schemas/booking";

export const addParticipant = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/bookings/{bookingId}/participants",
		tags: ["Bookings", "Participants"],
		summary: "Add participant to booking",
		description: "Add a client as a participant to a booking with a specific role",
	})
	.input(addParticipantInputSchema)
	.output(addParticipantOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "booking", "update");

		const { bookingId, clientId, role } = input;

		// Verify booking exists and belongs to organization
		const booking = await db.query.bookings.findFirst({
			where: and(
				eq(bookings.id, bookingId),
				eq(bookings.organizationId, context.organizationId),
				isNull(bookings.deletedAt),
			),
			columns: { id: true, referenceNumber: true },
		});

		if (!booking) {
			throw new ORPCError("NOT_FOUND", {
				message: "Booking not found",
			});
		}

		// Verify client exists and belongs to organization
		const client = await db.query.clients.findFirst({
			where: and(
				eq(clients.id, clientId),
				eq(clients.organizationId, context.organizationId),
				isNull(clients.deletedAt),
			),
			columns: { id: true, name: true },
		});

		if (!client) {
			throw new ORPCError("NOT_FOUND", {
				message: "Client not found",
			});
		}

		// Check if this client+role combination already exists for this booking
		const existingParticipant = await db.query.bookingParticipants.findFirst({
			where: and(
				eq(bookingParticipants.bookingId, bookingId),
				eq(bookingParticipants.clientId, clientId),
				eq(bookingParticipants.role, role),
			),
			columns: { id: true },
		});

		if (existingParticipant) {
			throw new ORPCError("CONFLICT", {
				message: `${client.name} is already a ${role} for this booking`,
			});
		}

		// Create the participant (catch unique constraint for race conditions)
		try {
			const [created] = await db
				.insert(bookingParticipants)
				.values({
					bookingId,
					clientId,
					role,
				})
				.returning({ id: bookingParticipants.id });

			if (!created) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Failed to add participant",
				});
			}

			return {
				data: { id: created.id },
				message: `${client.name} added as ${role}`,
			};
		} catch (error) {
			// Handle unique constraint violation (race condition)
			if (error instanceof Error && error.message.includes("unique")) {
				throw new ORPCError("CONFLICT", {
					message: `${client.name} is already a ${role} for this booking`,
				});
			}
			throw error;
		}
	});
