import { ORPCError } from "@orpc/server";
import {
	and,
	asc,
	bookingParticipants,
	bookings,
	clients,
	db,
	eq,
	isNull,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	listParticipantsInputSchema,
	listParticipantsOutputSchema,
} from "../../studio/schemas/booking";

export const listParticipants = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/bookings/{bookingId}/participants",
		tags: ["Bookings", "Participants"],
		summary: "List booking participants",
		description:
			"Get all participants for a specific booking with client details",
	})
	.input(listParticipantsInputSchema)
	.output(listParticipantsOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "booking", "read");

		const { bookingId } = input;

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

		// Fetch participants with client data (excluding soft-deleted clients)
		const participants = await db
			.select({
				id: bookingParticipants.id,
				bookingId: bookingParticipants.bookingId,
				clientId: bookingParticipants.clientId,
				role: bookingParticipants.role,
				createdAt: bookingParticipants.createdAt,
				updatedAt: bookingParticipants.updatedAt,
				client: {
					id: clients.id,
					name: clients.name,
					email: clients.email,
					phoneNumber: clients.phoneNumber,
				},
			})
			.from(bookingParticipants)
			.innerJoin(clients, eq(bookingParticipants.clientId, clients.id))
			.where(
				and(
					eq(bookingParticipants.bookingId, bookingId),
					isNull(clients.deletedAt),
				),
			)
			.orderBy(asc(bookingParticipants.createdAt));

		return {
			data: participants.map((p) => ({
				...p,
				createdAt: p.createdAt.toISOString(),
				updatedAt: p.updatedAt.toISOString(),
			})),
		};
	});
