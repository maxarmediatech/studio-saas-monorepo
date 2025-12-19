import {
	and,
	count,
	eq,
	gte,
	isNull,
	sql,
	receivedAmounts,
	paymentSchedules,
	bookings,
	db,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	getPaymentStatsInputSchema,
	getPaymentStatsOutputSchema,
} from "../../studio/schemas/payment";

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

export const getPaymentStats = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/studio-payments/stats",
		tags: ["Studio Payments"],
		summary: "Get payment statistics",
		description: "Get aggregate statistics about payments",
	})
	.input(getPaymentStatsInputSchema)
	.output(getPaymentStatsOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "payment", "list");

		const { bookingId } = input;

		const timeZone = normalizeTimeZone(context.membership.organization.timezone);
		const nowParts = getDateParts(new Date(), timeZone);
		const today = `${nowParts.year}-${nowParts.month}-${nowParts.day}`;
		const startOfMonth = `${nowParts.year}-${nowParts.month}-01`;

		// Build base conditions
		const receivedConditions = [
			eq(receivedAmounts.organizationId, context.organizationId),
			isNull(receivedAmounts.deletedAt),
		];

		const scheduleConditions = [
			eq(paymentSchedules.organizationId, context.organizationId),
			isNull(paymentSchedules.deletedAt),
		];

		if (bookingId) {
			receivedConditions.push(eq(receivedAmounts.bookingId, bookingId));
			scheduleConditions.push(eq(paymentSchedules.bookingId, bookingId));
		}

		// Total received
		const [totalReceivedResult] = await db
			.select({ sum: sql<string>`COALESCE(SUM(${receivedAmounts.amount}), 0)` })
			.from(receivedAmounts)
			.where(and(...receivedConditions));

		// Total scheduled
		const [totalScheduledResult] = await db
			.select({ sum: sql<string>`COALESCE(SUM(${paymentSchedules.amount}), 0)` })
			.from(paymentSchedules)
			.where(and(...scheduleConditions));

		// Total pending (scheduled - paid on pending schedules)
		const [totalPendingResult] = await db
			.select({
				sum: sql<string>`COALESCE(SUM(${paymentSchedules.amount} - ${paymentSchedules.paidAmount}), 0)`,
			})
			.from(paymentSchedules)
			.where(
				and(
					...scheduleConditions,
					sql`${paymentSchedules.status} NOT IN ('completed', 'cancelled')`,
				),
			);

		// Total overdue
		const [totalOverdueResult] = await db
			.select({
				sum: sql<string>`COALESCE(SUM(${paymentSchedules.amount} - ${paymentSchedules.paidAmount}), 0)`,
			})
			.from(paymentSchedules)
			.where(
				and(
					...scheduleConditions,
					sql`${paymentSchedules.dueDate} < ${today}`,
					sql`${paymentSchedules.status} NOT IN ('completed', 'cancelled')`,
				),
			);

		// Received this month
		const [receivedThisMonthResult] = await db
			.select({ sum: sql<string>`COALESCE(SUM(${receivedAmounts.amount}), 0)` })
			.from(receivedAmounts)
			.where(
				and(
					...receivedConditions,
					gte(receivedAmounts.receivedDate, startOfMonth),
				),
			);

		// By payment method
		const methodCounts = await db
			.select({
				paymentMethod: receivedAmounts.paymentMethod,
				sum: sql<string>`COALESCE(SUM(${receivedAmounts.amount}), 0)`,
			})
			.from(receivedAmounts)
			.where(and(...receivedConditions))
			.groupBy(receivedAmounts.paymentMethod);

		const byPaymentMethod: Record<string, string> = {};
		for (const row of methodCounts) {
			byPaymentMethod[row.paymentMethod] = row.sum;
		}

		// By schedule status
		const statusCounts = await db
			.select({
				status: paymentSchedules.status,
				count: count().mapWith(Number),
			})
			.from(paymentSchedules)
			.where(and(...scheduleConditions))
			.groupBy(paymentSchedules.status);

		const byScheduleStatus: Record<string, number> = {};
		for (const row of statusCounts) {
			byScheduleStatus[row.status] = row.count;
		}

		// Upcoming schedules (next 5 pending schedules due)
		const upcomingQuery = db
			.select({
				id: paymentSchedules.id,
				name: paymentSchedules.name,
				amount: paymentSchedules.amount,
				dueDate: paymentSchedules.dueDate,
				bookingName: bookings.name,
			})
			.from(paymentSchedules)
			.innerJoin(bookings, eq(paymentSchedules.bookingId, bookings.id))
			.where(
				and(
					...scheduleConditions,
					gte(paymentSchedules.dueDate, today),
					sql`${paymentSchedules.status} NOT IN ('completed', 'cancelled')`,
				),
			)
			.orderBy(paymentSchedules.dueDate)
			.limit(5);

		const upcomingSchedules = await upcomingQuery;

		return {
			data: {
				totalReceived: totalReceivedResult?.sum ?? "0",
				totalScheduled: totalScheduledResult?.sum ?? "0",
				totalPending: totalPendingResult?.sum ?? "0",
				totalOverdue: totalOverdueResult?.sum ?? "0",
				receivedThisMonth: receivedThisMonthResult?.sum ?? "0",
				byPaymentMethod,
				byScheduleStatus,
				upcomingSchedules: upcomingSchedules.map((s) => ({
					id: s.id,
					name: s.name,
					amount: s.amount,
					dueDate: s.dueDate,
					bookingName: s.bookingName,
				})),
			},
		};
	});
