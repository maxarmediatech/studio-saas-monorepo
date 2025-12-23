import { and, count, eq, gte, isNull, sql, bookings, db } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	getBookingStatsInputSchema,
	getBookingStatsOutputSchema,
} from "../../studio/schemas/booking";

export const getBookingStats = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/bookings/stats",
		tags: ["Bookings"],
		summary: "Get booking statistics",
		description: "Get aggregate statistics about bookings",
	})
	.input(getBookingStatsInputSchema)
	.output(getBookingStatsOutputSchema)
	.handler(async ({ input: _input, context }) => {
		requirePermission(context, "booking", "list");

		const baseConditions = [
			eq(bookings.organizationId, context.organizationId),
			isNull(bookings.deletedAt),
		];

		// Total bookings
		const [totalResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(bookings)
			.where(and(...baseConditions));

		// Bookings by status
		const statusCounts = await db
			.select({
				status: bookings.status,
				count: count().mapWith(Number),
			})
			.from(bookings)
			.where(and(...baseConditions))
			.groupBy(bookings.status);

		const byStatus: Record<string, number> = {};
		for (const row of statusCounts) {
			byStatus[row.status] = row.count;
		}

		// Financial totals
		const [financials] = await db
			.select({
				totalRevenue: sql<string>`COALESCE(SUM(${bookings.packageCost}), 0)`,
				totalReceived: sql<string>`COALESCE(SUM(${bookings.totalReceived}), 0)`,
				totalExpenses: sql<string>`COALESCE(SUM(${bookings.totalExpenses}), 0)`,
			})
			.from(bookings)
			.where(and(...baseConditions));

		const totalRevenue = parseFloat(financials?.totalRevenue ?? "0");
		const totalReceived = parseFloat(financials?.totalReceived ?? "0");
		const totalExpenses = parseFloat(financials?.totalExpenses ?? "0");
		const totalOutstanding = totalRevenue - totalReceived;

		// New this month (UTC to avoid server-local timezone drift)
		const now = new Date();
		const startOfMonth = new Date(
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
		);

		const [newThisMonthResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(bookings)
			.where(
				and(
					...baseConditions,
					gte(bookings.createdAt, startOfMonth),
				),
			);

		return {
			data: {
				totalBookings: totalResult?.count ?? 0,
				byStatus,
				totalRevenue: totalRevenue.toFixed(2),
				totalReceived: totalReceived.toFixed(2),
				totalExpenses: totalExpenses.toFixed(2),
				totalOutstanding: totalOutstanding.toFixed(2),
				newThisMonth: newThisMonthResult?.count ?? 0,
			},
		};
	});
