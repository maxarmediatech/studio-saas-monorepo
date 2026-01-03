import {
	and,
	bookingParticipants,
	bookings,
	clients,
	count,
	db,
	eq,
	gte,
	isNull,
	sql,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	getClientStatsInputSchema,
	getClientStatsOutputSchema,
} from "../../studio/schemas/client";

export const getClientStats = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/clients/stats",
		tags: ["Clients"],
		summary: "Get client statistics",
		description: "Get aggregate statistics about clients",
	})
	.input(getClientStatsInputSchema)
	.output(getClientStatsOutputSchema)
	.handler(async ({ input: _input, context }) => {
		requirePermission(context, "client", "list");

		// Total clients (non-deleted)
		const [totalResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(clients)
			.where(
				and(
					eq(clients.organizationId, context.organizationId),
					isNull(clients.deletedAt),
				),
			);

		// Active clients (with at least one non-deleted booking via participants)
		const [activeResult] = await db
			.select({
				count: sql<number>`count(distinct ${clients.id})`.mapWith(
					Number,
				),
			})
			.from(clients)
			.innerJoin(
				bookingParticipants,
				eq(clients.id, bookingParticipants.clientId),
			)
			.innerJoin(bookings, eq(bookingParticipants.bookingId, bookings.id))
			.where(
				and(
					eq(clients.organizationId, context.organizationId),
					isNull(clients.deletedAt),
					eq(bookings.organizationId, context.organizationId),
					isNull(bookings.deletedAt),
				),
			);

		// New clients this month (UTC to avoid server-local timezone drift)
		const now = new Date();
		const startOfMonth = new Date(
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
		);

		const [newThisMonthResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(clients)
			.where(
				and(
					eq(clients.organizationId, context.organizationId),
					isNull(clients.deletedAt),
					gte(clients.createdAt, startOfMonth),
				),
			);

		// Clients with active bookings (status not completed/cancelled)
		const [clientsWithActiveResult] = await db
			.select({
				count: sql<number>`count(distinct ${clients.id})`.mapWith(
					Number,
				),
			})
			.from(clients)
			.innerJoin(
				bookingParticipants,
				eq(clients.id, bookingParticipants.clientId),
			)
			.innerJoin(bookings, eq(bookingParticipants.bookingId, bookings.id))
			.where(
				and(
					eq(clients.organizationId, context.organizationId),
					isNull(clients.deletedAt),
					eq(bookings.organizationId, context.organizationId),
					isNull(bookings.deletedAt),
					sql`${bookings.status} NOT IN ('completed', 'cancelled')`,
				),
			);

		return {
			data: {
				totalClients: totalResult?.count ?? 0,
				activeClients: activeResult?.count ?? 0,
				newClientsThisMonth: newThisMonthResult?.count ?? 0,
				clientsWithActiveBookings: clientsWithActiveResult?.count ?? 0,
			},
		};
	});
