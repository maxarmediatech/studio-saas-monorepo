import { ORPCError } from "@orpc/server";
import {
	and,
	eq,
	isNull,
	sql,
	clients,
	bookings,
	bookingParticipants,
	db,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	getClientInputSchema,
	getClientOutputSchema,
} from "../../studio/schemas/client";

export const getClient = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/clients/{id}",
		tags: ["Clients"],
		summary: "Get client",
		description: "Get a single client by ID with booking statistics",
	})
	.input(getClientInputSchema)
	.output(getClientOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "client", "read");

		const { id } = input;

		// Get client with organization scope
		const client = await db.query.clients.findFirst({
			where: and(
				eq(clients.id, id),
				eq(clients.organizationId, context.organizationId),
			),
		});

		if (!client) {
			throw new ORPCError("NOT_FOUND", {
				message: "Client not found",
			});
		}

		// Get booking counts (client can be linked via booking_participants)
		const [bookingsCountResult] = await db
			.select({
				count: sql<number>`count(distinct ${bookingParticipants.bookingId})`.mapWith(
					Number,
				),
			})
			.from(bookingParticipants)
			.innerJoin(bookings, eq(bookingParticipants.bookingId, bookings.id))
			.where(
				and(
					eq(bookingParticipants.clientId, id),
					eq(bookings.organizationId, context.organizationId),
					isNull(bookings.deletedAt),
				),
			);

		// Active bookings (not completed or cancelled)
		const [activeBookingsResult] = await db
			.select({
				count: sql<number>`count(distinct ${bookingParticipants.bookingId})`.mapWith(
					Number,
				),
			})
			.from(bookingParticipants)
			.innerJoin(bookings, eq(bookingParticipants.bookingId, bookings.id))
			.where(
				and(
					eq(bookingParticipants.clientId, id),
					eq(bookings.organizationId, context.organizationId),
					isNull(bookings.deletedAt),
					sql`${bookings.status} NOT IN ('completed', 'cancelled')`,
				),
			);

		return {
			data: {
				...client,
				metadata: client.metadata as Record<string, unknown> | null,
				createdAt: client.createdAt.toISOString(),
				updatedAt: client.updatedAt.toISOString(),
				deletedAt: client.deletedAt?.toISOString() ?? null,
				bookingsCount: bookingsCountResult?.count ?? 0,
				activeBookingsCount: activeBookingsResult?.count ?? 0,
			},
		};
	});
