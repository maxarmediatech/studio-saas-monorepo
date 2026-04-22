import { and, bookings, count, db, eq, gte, isNull, sql } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { getDateParts, normalizeTimeZone } from "../../studio/lib/date-helpers";
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
		await requirePermission(context, "booking", "list");

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

		const totalRevenue = Number.parseFloat(financials?.totalRevenue ?? "0");
		const totalReceived = Number.parseFloat(
			financials?.totalReceived ?? "0",
		);
		const totalExpenses = Number.parseFloat(
			financials?.totalExpenses ?? "0",
		);
		const totalOutstanding = totalRevenue - totalReceived;

		// New this month by booking date, not record creation time.
		const timeZone = normalizeTimeZone(
			context.membership.organization.timezone,
		);
		const nowParts = getDateParts(new Date(), timeZone);
		const startOfMonth = `${nowParts.year}-${nowParts.month}-01`;

		const [newThisMonthResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(bookings)
			.where(
				and(...baseConditions, gte(bookings.bookingDate, startOfMonth)),
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
