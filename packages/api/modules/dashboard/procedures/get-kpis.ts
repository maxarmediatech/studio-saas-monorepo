import {
	and,
	bookings,
	count,
	db,
	deliverables,
	eq,
	expenses,
	gte,
	isNull,
	paymentSchedules,
	receivedAmounts,
	shoots,
	sql,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	formatDateParts,
	getDateParts,
	normalizeTimeZone,
} from "../../studio/lib/date-helpers";
import { requirePermission } from "../../studio/lib/permissions";
import {
	getKpisInputSchema,
	getKpisOutputSchema,
} from "../../studio/schemas/dashboard";

export const getKpis = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/dashboard/kpis",
		tags: ["Dashboard"],
		summary: "Get KPIs",
		description: "Get key performance indicators for the studio",
	})
	.input(getKpisInputSchema)
	.output(getKpisOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "booking", "read");

		const { dateRange } = input;

		const timeZone = normalizeTimeZone(
			context.membership.organization.timezone,
		);
		const nowParts = getDateParts(new Date(), timeZone);
		const todayStr = formatDateParts(nowParts);
		const startOfMonthStr = `${nowParts.year}-${nowParts.month}-01`;

		const rangeStartStr = dateRange?.start ?? startOfMonthStr;
		const rangeEndStr = dateRange?.end ?? todayStr;
		const rangeStartDate = new Date(rangeStartStr);
		const rangeEndDate = new Date(rangeEndStr);

		// Calculate previous period for comparison
		const periodLength = rangeEndDate.getTime() - rangeStartDate.getTime();
		const previousPeriodStart = new Date(
			rangeStartDate.getTime() - periodLength,
		);
		const previousPeriodEnd = new Date(rangeStartDate.getTime() - 1);
		const previousPeriodStartStr = previousPeriodStart
			.toISOString()
			.split("T")[0];
		const previousPeriodEndStr = previousPeriodEnd
			.toISOString()
			.split("T")[0];

		// Current period revenue
		const [currentPeriodTotals] = await db
			.select({
				totalRevenue: sql<string>`COALESCE(SUM(${bookings.packageCost}), 0)::text`,
				bookingCount: count().mapWith(Number),
			})
			.from(bookings)
			.where(
				and(
					eq(bookings.organizationId, context.organizationId),
					isNull(bookings.deletedAt),
					gte(bookings.bookingDate, rangeStartStr),
					sql`${bookings.bookingDate} <= ${rangeEndStr}`,
				),
			);

		// Previous period revenue for growth calculation
		const [previousPeriodTotals] = await db
			.select({
				totalRevenue: sql<string>`COALESCE(SUM(${bookings.packageCost}), 0)::text`,
			})
			.from(bookings)
			.where(
				and(
					eq(bookings.organizationId, context.organizationId),
					isNull(bookings.deletedAt),
					gte(bookings.bookingDate, previousPeriodStartStr),
					sql`${bookings.bookingDate} <= ${previousPeriodEndStr}`,
				),
			);

		const [receivedTotals] = await db
			.select({
				totalReceived: sql<string>`COALESCE(SUM(${receivedAmounts.amount}), 0)::text`,
			})
			.from(receivedAmounts)
			.innerJoin(bookings, eq(receivedAmounts.bookingId, bookings.id))
			.where(
				and(
					eq(receivedAmounts.organizationId, context.organizationId),
					isNull(receivedAmounts.deletedAt),
					isNull(bookings.deletedAt),
					gte(receivedAmounts.receivedDate, rangeStartStr),
					sql`${receivedAmounts.receivedDate} <= ${rangeEndStr}`,
				),
			);

		const [expenseTotals] = await db
			.select({
				totalExpenses: sql<string>`COALESCE(SUM(${expenses.amount}), 0)::text`,
			})
			.from(expenses)
			.where(
				and(
					eq(expenses.organizationId, context.organizationId),
					isNull(expenses.deletedAt),
					gte(expenses.expenseDate, rangeStartStr),
					sql`${expenses.expenseDate} <= ${rangeEndStr}`,
				),
			);

		const totalRevenue = Number.parseFloat(
			currentPeriodTotals?.totalRevenue ?? "0",
		);
		const totalReceived = Number.parseFloat(
			receivedTotals?.totalReceived ?? "0",
		);
		const totalExpenses = Number.parseFloat(
			expenseTotals?.totalExpenses ?? "0",
		);

		// Booking counts
		const [activeBookingsResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(bookings)
			.where(
				and(
					eq(bookings.organizationId, context.organizationId),
					isNull(bookings.deletedAt),
					sql`${bookings.status} IN ('new', 'preparation', 'shooting', 'delivery')`,
				),
			);

		const [completedBookingsResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(bookings)
			.where(
				and(
					eq(bookings.organizationId, context.organizationId),
					isNull(bookings.deletedAt),
					eq(bookings.status, "completed"),
				),
			);

		const [totalBookingsResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(bookings)
			.where(
				and(
					eq(bookings.organizationId, context.organizationId),
					isNull(bookings.deletedAt),
				),
			);

		// Overdue payment schedules
		const [overduePaymentsResult] = await db
			.select({
				total: sql<string>`COALESCE(SUM(${paymentSchedules.amount} - COALESCE(${paymentSchedules.paidAmount}, 0)), 0)::text`,
			})
			.from(paymentSchedules)
			.innerJoin(bookings, eq(paymentSchedules.bookingId, bookings.id))
			.where(
				and(
					eq(paymentSchedules.organizationId, context.organizationId),
					isNull(paymentSchedules.deletedAt),
					isNull(bookings.deletedAt),
					sql`${paymentSchedules.status} IN ('pending', 'partial', 'overdue')`,
					sql`${paymentSchedules.dueDate} < ${todayStr}`,
				),
			);

		const [pendingPaymentsResult] = await db
			.select({
				total: sql<string>`COALESCE(SUM(${paymentSchedules.amount} - COALESCE(${paymentSchedules.paidAmount}, 0)), 0)::text`,
			})
			.from(paymentSchedules)
			.innerJoin(bookings, eq(paymentSchedules.bookingId, bookings.id))
			.where(
				and(
					eq(paymentSchedules.organizationId, context.organizationId),
					isNull(paymentSchedules.deletedAt),
					isNull(bookings.deletedAt),
					gte(paymentSchedules.dueDate, rangeStartStr),
					sql`${paymentSchedules.dueDate} <= ${rangeEndStr}`,
					sql`${paymentSchedules.status} NOT IN ('completed', 'cancelled')`,
				),
			);

		// Total shoots
		const [totalShootsResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(shoots)
			.where(
				and(
					eq(shoots.organizationId, context.organizationId),
					isNull(shoots.deletedAt),
				),
			);

		// On-time delivery rate (deliverables completed before or on due date)
		const [deliverableStats] = await db
			.select({
				totalCompleted: sql<number>`COUNT(*) FILTER (WHERE ${deliverables.workflowStatus} = 'approved')`,
				onTimeCompleted: sql<number>`COUNT(*) FILTER (WHERE ${deliverables.workflowStatus} = 'approved' AND (${deliverables.dueDate} IS NULL OR ${deliverables.deliveredAt} <= ${deliverables.dueDate}))`,
			})
			.from(deliverables)
			.where(
				and(
					eq(deliverables.organizationId, context.organizationId),
					isNull(deliverables.deletedAt),
				),
			);

		// Calculate metrics
		const currentRevenue = Number.parseFloat(
			currentPeriodTotals?.totalRevenue ?? "0",
		);
		const previousRevenue = Number.parseFloat(
			previousPeriodTotals?.totalRevenue ?? "0",
		);
		const revenueGrowth =
			previousRevenue > 0
				? ((currentRevenue - previousRevenue) / previousRevenue) * 100
				: 0;

		const totalBookings = totalBookingsResult?.count ?? 0;
		const completedBookings = completedBookingsResult?.count ?? 0;
		const currentBookingCount = currentPeriodTotals?.bookingCount ?? 0;
		const averageBookingValue =
			currentBookingCount > 0 ? totalRevenue / currentBookingCount : 0;

		const collectionRate =
			totalRevenue > 0 ? (totalReceived / totalRevenue) * 100 : 0;

		const profitMargin =
			totalReceived > 0
				? ((totalReceived - totalExpenses) / totalReceived) * 100
				: 0;

		const conversionRate =
			totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0;

		const totalShoots = totalShootsResult?.count ?? 0;
		const averageShootsPerBooking =
			totalBookings > 0 ? totalShoots / totalBookings : 0;

		const totalCompleted = deliverableStats?.totalCompleted ?? 0;
		const onTimeCompleted = deliverableStats?.onTimeCompleted ?? 0;
		const onTimeDeliveryRate =
			totalCompleted > 0 ? (onTimeCompleted / totalCompleted) * 100 : 100;

		return {
			data: {
				totalRevenue: totalRevenue.toFixed(2),
				averageBookingValue: averageBookingValue.toFixed(2),
				revenueGrowth: Math.round(revenueGrowth * 100) / 100,

				totalReceived: totalReceived.toFixed(2),
				totalPending: pendingPaymentsResult?.total ?? "0",
				collectionRate: Math.round(collectionRate * 100) / 100,
				overduePayments: overduePaymentsResult?.total ?? "0",

				totalExpenses: totalExpenses.toFixed(2),
				profitMargin: Math.round(profitMargin * 100) / 100,

				totalBookings,
				activeBookings: activeBookingsResult?.count ?? 0,
				completedBookings,
				conversionRate: Math.round(conversionRate * 100) / 100,

				totalShoots,
				averageShootsPerBooking:
					Math.round(averageShootsPerBooking * 100) / 100,
				onTimeDeliveryRate: Math.round(onTimeDeliveryRate * 100) / 100,
			},
		};
	});
