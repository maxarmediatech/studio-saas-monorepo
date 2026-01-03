import { and, count, db, eq, gte, isNull, shoots, sql } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	getShootStatsInputSchema,
	getShootStatsOutputSchema,
} from "../../studio/schemas/shoot";

const DEFAULT_TIMEZONE = "UTC";

function normalizeTimeZone(timeZone: string | null | undefined): string {
	if (!timeZone) {
		return DEFAULT_TIMEZONE;
	}

	try {
		new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
		return timeZone;
	} catch {
		return DEFAULT_TIMEZONE;
	}
}

function getDateParts(date: Date, timeZone: string) {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(date);
	const year = parts.find((part) => part.type === "year")?.value;
	const month = parts.find((part) => part.type === "month")?.value;
	const day = parts.find((part) => part.type === "day")?.value;

	if (!year || !month || !day) {
		const fallback = date.toISOString().split("T")[0];
		const [fallbackYear, fallbackMonth, fallbackDay] = fallback.split("-");
		return { year: fallbackYear, month: fallbackMonth, day: fallbackDay };
	}

	return { year, month, day };
}

export const getShootStats = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/shoots/stats",
		tags: ["Shoots"],
		summary: "Get shoot statistics",
		description: "Get aggregate statistics about shoots",
	})
	.input(getShootStatsInputSchema)
	.output(getShootStatsOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "shoot", "list");

		const { bookingId } = input;

		const baseConditions = [
			eq(shoots.organizationId, context.organizationId),
			isNull(shoots.deletedAt),
		];

		if (bookingId) {
			baseConditions.push(eq(shoots.bookingId, bookingId));
		}

		// Total shoots
		const [totalResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(shoots)
			.where(and(...baseConditions));

		// Shoots by status
		const statusCounts = await db
			.select({
				status: shoots.status,
				count: count().mapWith(Number),
			})
			.from(shoots)
			.where(and(...baseConditions))
			.groupBy(shoots.status);

		const byStatus: Record<string, number> = {};
		for (const row of statusCounts) {
			byStatus[row.status] = row.count;
		}

		const timeZone = normalizeTimeZone(
			context.membership.organization.timezone,
		);
		const nowParts = getDateParts(new Date(), timeZone);
		const today = `${nowParts.year}-${nowParts.month}-${nowParts.day}`;
		const [upcomingResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(shoots)
			.where(
				and(
					...baseConditions,
					gte(shoots.shootDate, today),
					sql`${shoots.status} NOT IN ('completed', 'cancelled')`,
				),
			);

		// Completed shoots
		const [completedResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(shoots)
			.where(and(...baseConditions, eq(shoots.status, "completed")));

		// Shoots this month (org timezone)
		const startOfMonth = `${nowParts.year}-${nowParts.month}-01`;

		const [thisMonthResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(shoots)
			.where(and(...baseConditions, gte(shoots.shootDate, startOfMonth)));

		return {
			data: {
				totalShoots: totalResult?.count ?? 0,
				byStatus,
				upcomingShoots: upcomingResult?.count ?? 0,
				completedShoots: completedResult?.count ?? 0,
				shootsThisMonth: thisMonthResult?.count ?? 0,
			},
		};
	});
