import {
	and,
	assignmentSubmissions,
	bookings,
	count,
	db,
	deliverables,
	desc,
	eq,
	gte,
	isNull,
	shootAssignments,
	shoots,
	sql,
	tasks,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	addDays,
	formatDateParts,
	getDateParts,
	getStartOfWeek,
	normalizeTimeZone,
} from "../../studio/lib/date-helpers";
import { requirePermission } from "../../studio/lib/permissions";
import {
	type BookingPhase,
	bookingPhaseSchema,
} from "../../studio/schemas/common";
import {
	getDashboardInputSchema,
	getDashboardOutputSchema,
} from "../../studio/schemas/dashboard";

export const getDashboard = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/dashboard",
		tags: ["Dashboard"],
		summary: "Get dashboard",
		description:
			"Get comprehensive dashboard data including financial, booking, and operational summaries",
	})
	.input(getDashboardInputSchema)
	.output(getDashboardOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "booking", "read");

		const { dateRange } = input;

		// Calculate date boundaries in org timezone
		const timeZone = normalizeTimeZone(
			context.membership.organization.timezone,
		);
		const nowParts = getDateParts(new Date(), timeZone);
		const today = formatDateParts(nowParts);
		const startOfMonth = `${nowParts.year}-${nowParts.month}-01`;
		const startOfWeek = getStartOfWeek(nowParts);
		const endOfWeek = addDays(startOfWeek, 7);

		const rangeStart = dateRange?.start ?? startOfMonth;
		const rangeEnd = dateRange?.end ?? today;

		// Financial summary
		const bookingRangeConditions = dateRange
			? [
					eq(bookings.organizationId, context.organizationId),
					isNull(bookings.deletedAt),
					gte(bookings.bookingDate, rangeStart),
					sql`${bookings.bookingDate} <= ${rangeEnd}`,
				]
			: [
					eq(bookings.organizationId, context.organizationId),
					isNull(bookings.deletedAt),
				];
		const [bookingTotals] = await db
			.select({
				totalRevenue: sql<string>`COALESCE(SUM(${bookings.packageCost}), 0)::text`,
				totalReceived: sql<string>`COALESCE(SUM(${bookings.totalReceived}), 0)::text`,
				totalExpenses: sql<string>`COALESCE(SUM(${bookings.totalExpenses}), 0)::text`,
			})
			.from(bookings)
			.where(and(...bookingRangeConditions));

		const totalRevenue = Number.parseFloat(
			bookingTotals?.totalRevenue ?? "0",
		);
		const totalReceived = Number.parseFloat(
			bookingTotals?.totalReceived ?? "0",
		);
		const totalExpenses = Number.parseFloat(
			bookingTotals?.totalExpenses ?? "0",
		);
		const totalPending = totalRevenue - totalReceived;
		const netProfit = totalReceived - totalExpenses;
		const collectionRate =
			totalRevenue > 0 ? (totalReceived / totalRevenue) * 100 : 0;

		// Booking summary by phase
		const bookingsByPhase = await db
			.select({
				status: bookings.status,
				count: count().mapWith(Number),
			})
			.from(bookings)
			.where(and(...bookingRangeConditions))
			.groupBy(bookings.status);

		const byPhase = Object.fromEntries(
			bookingPhaseSchema.options.map((status) => [status, 0]),
		) as Record<BookingPhase, number>;
		let totalBookings = 0;
		for (const row of bookingsByPhase) {
			const status = row.status as BookingPhase;
			byPhase[status] = row.count;
			totalBookings += row.count;
		}

		// New bookings this month
		const [newThisMonthResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(bookings)
			.where(
				and(
					eq(bookings.organizationId, context.organizationId),
					isNull(bookings.deletedAt),
					gte(bookings.bookingDate, dateRange?.start ?? startOfMonth),
					sql`${bookings.bookingDate} <= ${dateRange?.end ?? today}`,
				),
			);

		// Completed this month
		const [completedThisMonthResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(bookings)
			.where(
				and(
					eq(bookings.organizationId, context.organizationId),
					isNull(bookings.deletedAt),
					eq(bookings.status, "completed"),
					gte(
						sql`DATE(${bookings.updatedAt} AT TIME ZONE ${timeZone})`,
						dateRange?.start ?? startOfMonth,
					),
					sql`DATE(${bookings.updatedAt} AT TIME ZONE ${timeZone}) <= ${dateRange?.end ?? today}`,
				),
			);

		// Operations summary
		const thirtyDaysLater = addDays(today, 30);

		const [upcomingShootsResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(shoots)
			.where(
				and(
					eq(shoots.organizationId, context.organizationId),
					isNull(shoots.deletedAt),
					gte(shoots.shootDate, today),
					sql`${shoots.shootDate} <= ${thirtyDaysLater}`,
					sql`${shoots.status} NOT IN ('completed', 'cancelled')`,
				),
			);

		// Shoots this week
		const [shootsThisWeekResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(shoots)
			.where(
				and(
					eq(shoots.organizationId, context.organizationId),
					isNull(shoots.deletedAt),
					gte(shoots.shootDate, startOfWeek),
					sql`${shoots.shootDate} < ${endOfWeek}`,
					sql`${shoots.status} NOT IN ('completed', 'cancelled')`,
				),
			);

		// Pending tasks (not_started or assigned)
		const [pendingTasksResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(tasks)
			.where(
				and(
					eq(tasks.organizationId, context.organizationId),
					isNull(tasks.deletedAt),
					sql`${tasks.workflowStatus} IN ('not_started', 'assigned')`,
				),
			);

		// Overdue tasks
		const [overdueTasksResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(tasks)
			.where(
				and(
					eq(tasks.organizationId, context.organizationId),
					isNull(tasks.deletedAt),
					sql`${tasks.workflowStatus} IN ('not_started', 'assigned', 'submitted', 'in_review', 'revision_requested')`,
					sql`${tasks.dueDate} < ${today}`,
				),
			);

		// Pending deliverables
		const [pendingDeliverablesResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(deliverables)
			.where(
				and(
					eq(deliverables.organizationId, context.organizationId),
					isNull(deliverables.deletedAt),
					sql`${deliverables.workflowStatus} IN ('not_started', 'assigned')`,
				),
			);

		// Overdue deliverables
		const [overdueDeliverablesResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(deliverables)
			.where(
				and(
					eq(deliverables.organizationId, context.organizationId),
					isNull(deliverables.deletedAt),
					sql`${deliverables.workflowStatus} IN ('not_started', 'assigned', 'submitted', 'in_review', 'revision_requested')`,
					sql`${deliverables.dueDate} < ${today}`,
				),
			);

		// Pending submissions
		const [pendingSubmissionsResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(assignmentSubmissions)
			.where(
				and(
					eq(
						assignmentSubmissions.organizationId,
						context.organizationId,
					),
					sql`${assignmentSubmissions.status} IN ('submitted', 'in_review')`,
				),
			);

		// Recent bookings (last 5)
		const recentBookingsList = await db.query.bookings.findMany({
			where: and(...bookingRangeConditions),
			orderBy: [desc(bookings.bookingDate), desc(bookings.createdAt)],
			limit: 5,
			columns: {
				id: true,
				name: true,
				referenceNumber: true,
				status: true,
				packageCost: true,
				totalReceived: true,
				bookingDate: true,
				createdAt: true,
			},
		});

		// Upcoming shoots (next 5 with assignment count)
		const upcomingShootsList = await db
			.select({
				id: shoots.id,
				name: shoots.name,
				bookingId: shoots.bookingId,
				shootDate: shoots.shootDate,
				startTime: shoots.startTime,
				venue: shoots.venue,
			})
			.from(shoots)
			.where(
				and(
					eq(shoots.organizationId, context.organizationId),
					isNull(shoots.deletedAt),
					gte(shoots.shootDate, today),
					sql`${shoots.status} NOT IN ('completed', 'cancelled')`,
				),
			)
			.orderBy(shoots.shootDate, shoots.startTime)
			.limit(5);

		// Get booking names and assignment counts for shoots
		const shootsWithDetails = await Promise.all(
			upcomingShootsList.map(async (shoot) => {
				const booking = await db.query.bookings.findFirst({
					where: eq(bookings.id, shoot.bookingId),
					columns: { name: true },
				});

				const [assignmentCount] = await db
					.select({ count: count().mapWith(Number) })
					.from(shootAssignments)
					.where(eq(shootAssignments.shootId, shoot.id));

				return {
					id: shoot.id,
					title: shoot.name,
					bookingId: shoot.bookingId,
					bookingName: booking?.name ?? "Unknown",
					shootDate: shoot.shootDate,
					startTime: shoot.startTime,
					location: shoot.venue,
					assignedCount: assignmentCount?.count ?? 0,
				};
			}),
		);

		return {
			data: {
				financial: {
					totalRevenue: totalRevenue.toFixed(2),
					totalReceived: totalReceived.toFixed(2),
					totalPending: totalPending.toFixed(2),
					totalExpenses: totalExpenses.toFixed(2),
					netProfit: netProfit.toFixed(2),
					collectionRate: Math.round(collectionRate * 100) / 100,
				},
				bookings: {
					total: totalBookings,
					byPhase,
					newThisMonth: newThisMonthResult?.count ?? 0,
					completedThisMonth: completedThisMonthResult?.count ?? 0,
				},
				operations: {
					upcomingShoots: upcomingShootsResult?.count ?? 0,
					shootsThisWeek: shootsThisWeekResult?.count ?? 0,
					pendingTasks: pendingTasksResult?.count ?? 0,
					overdueTasks: overdueTasksResult?.count ?? 0,
					pendingDeliverables: pendingDeliverablesResult?.count ?? 0,
					overdueDeliverables: overdueDeliverablesResult?.count ?? 0,
					pendingSubmissions: pendingSubmissionsResult?.count ?? 0,
				},
				recentBookings: recentBookingsList.map((b) => ({
					id: b.id,
					name: b.name,
					referenceNumber: b.referenceNumber,
					status: b.status,
					packageCost: String(b.packageCost),
					totalReceived: String(b.totalReceived),
					bookingDate: b.bookingDate,
					createdAt: b.createdAt.toISOString(),
				})),
				upcomingShoots: shootsWithDetails,
			},
		};
	});
