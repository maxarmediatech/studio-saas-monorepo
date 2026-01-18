import {
	and,
	asc,
	assignmentSubmissions,
	bookings,
	db,
	deliverables,
	eq,
	gte,
	isNull,
	paymentSchedules,
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
	normalizeTimeZone,
} from "../../studio/lib/date-helpers";
import { requirePermission } from "../../studio/lib/permissions";
import {
	getQuickActionsInputSchema,
	getQuickActionsOutputSchema,
	type QuickActionItem,
} from "../../studio/schemas/dashboard";

export const getQuickActions = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/dashboard/actions",
		tags: ["Dashboard"],
		summary: "Get quick actions",
		description: "Get prioritized action items requiring attention",
	})
	.input(getQuickActionsInputSchema)
	.output(getQuickActionsOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "booking", "read");

		const { limit } = input;

		const timeZone = normalizeTimeZone(
			context.membership.organization.timezone,
		);
		const nowParts = getDateParts(new Date(), timeZone);
		const todayStr = formatDateParts(nowParts);

		const actions: QuickActionItem[] = [];

		// 1. Overdue payment schedules (high priority)
		const overduePayments = await db
			.select({
				id: paymentSchedules.id,
				bookingId: paymentSchedules.bookingId,
				amount: paymentSchedules.amount,
				paidAmount: paymentSchedules.paidAmount,
				dueDate: paymentSchedules.dueDate,
				createdAt: paymentSchedules.createdAt,
			})
			.from(paymentSchedules)
			.innerJoin(bookings, eq(paymentSchedules.bookingId, bookings.id))
			.where(
				and(
					eq(paymentSchedules.organizationId, context.organizationId),
					sql`${paymentSchedules.status} IN ('pending', 'partial', 'overdue')`,
					sql`${paymentSchedules.dueDate} < ${todayStr}`,
					isNull(bookings.deletedAt),
				),
			)
			.orderBy(asc(paymentSchedules.dueDate))
			.limit(limit);

		for (const payment of overduePayments) {
			const booking = await db.query.bookings.findFirst({
				where: eq(bookings.id, payment.bookingId),
				columns: { name: true },
			});

			const outstanding =
				Number.parseFloat(payment.amount) -
				Number.parseFloat(payment.paidAmount ?? "0");

			actions.push({
				type: "overdue_payment",
				title: `Overdue payment: ${booking?.name ?? "Unknown"}`,
				description: `₹${outstanding.toFixed(2)} due on ${payment.dueDate}`,
				priority: "high",
				entityType: "payment",
				entityId: payment.id,
				bookingId: payment.bookingId,
				dueDate: payment.dueDate,
				createdAt: payment.createdAt.toISOString(),
			});
		}

		// 2. Overdue tasks (high priority)
		const overdueTasks = await db
			.select({
				id: tasks.id,
				name: tasks.name,
				bookingId: tasks.bookingId,
				dueDate: tasks.dueDate,
				createdAt: tasks.createdAt,
			})
			.from(tasks)
			.innerJoin(bookings, eq(tasks.bookingId, bookings.id))
			.where(
				and(
					eq(tasks.organizationId, context.organizationId),
					isNull(tasks.deletedAt),
					sql`${tasks.workflowStatus} IN ('not_started', 'assigned', 'revision_requested')`,
					sql`${tasks.dueDate} < ${todayStr}`,
					isNull(bookings.deletedAt),
				),
			)
			.orderBy(asc(tasks.dueDate))
			.limit(limit);

		for (const task of overdueTasks) {
			actions.push({
				type: "overdue_task",
				title: `Overdue task: ${task.name}`,
				description: `Was due on ${task.dueDate}`,
				priority: "high",
				entityType: "task",
				entityId: task.id,
				bookingId: task.bookingId,
				dueDate: task.dueDate,
				createdAt: task.createdAt.toISOString(),
			});
		}

		// 3. Overdue deliverables (high priority)
		const overdueDeliverables = await db
			.select({
				id: deliverables.id,
				name: deliverables.name,
				bookingId: deliverables.bookingId,
				dueDate: deliverables.dueDate,
				createdAt: deliverables.createdAt,
			})
			.from(deliverables)
			.innerJoin(bookings, eq(deliverables.bookingId, bookings.id))
			.where(
				and(
					eq(deliverables.organizationId, context.organizationId),
					isNull(deliverables.deletedAt),
					sql`${deliverables.workflowStatus} IN ('not_started', 'assigned', 'revision_requested')`,
					sql`${deliverables.dueDate} < ${todayStr}`,
					isNull(bookings.deletedAt),
				),
			)
			.orderBy(asc(deliverables.dueDate))
			.limit(limit);

		for (const deliverable of overdueDeliverables) {
			actions.push({
				type: "overdue_deliverable",
				title: `Overdue deliverable: ${deliverable.name}`,
				description: `Was due on ${deliverable.dueDate}`,
				priority: "high",
				entityType: "deliverable",
				entityId: deliverable.id,
				bookingId: deliverable.bookingId,
				dueDate: deliverable.dueDate,
				createdAt: deliverable.createdAt.toISOString(),
			});
		}

		// 4. Pending submissions (medium priority)
		const pendingSubmissions = await db
			.select({
				id: assignmentSubmissions.id,
				taskId: assignmentSubmissions.taskId,
				deliverableId: assignmentSubmissions.deliverableId,
				submittedAt: assignmentSubmissions.submittedAt,
				createdAt: assignmentSubmissions.createdAt,
			})
			.from(assignmentSubmissions)
			.where(
				and(
					eq(
						assignmentSubmissions.organizationId,
						context.organizationId,
					),
					sql`${assignmentSubmissions.status} IN ('submitted', 'in_review')`,
				),
			)
			.orderBy(asc(assignmentSubmissions.submittedAt))
			.limit(limit);

		for (const submission of pendingSubmissions) {
			let entityName = "Unknown";
			let bookingId: string | undefined;

			if (submission.taskId) {
				const task = await db.query.tasks.findFirst({
					where: eq(tasks.id, submission.taskId),
					columns: { name: true, bookingId: true },
				});
				entityName = task?.name ?? "Unknown task";
				bookingId = task?.bookingId;
			} else if (submission.deliverableId) {
				const deliverable = await db.query.deliverables.findFirst({
					where: eq(deliverables.id, submission.deliverableId),
					columns: { name: true, bookingId: true },
				});
				entityName = deliverable?.name ?? "Unknown deliverable";
				bookingId = deliverable?.bookingId;
			}

			actions.push({
				type: "pending_submission",
				title: `Review submission: ${entityName}`,
				description: `Submitted for review${submission.submittedAt ? ` on ${new Date(submission.submittedAt).toISOString().split("T")[0]}` : ""}`,
				priority: "medium",
				entityType: "submission",
				entityId: submission.id,
				bookingId,
				dueDate: null,
				createdAt: submission.createdAt.toISOString(),
			});
		}

		// 5. Upcoming shoots without crew (medium priority)
		const upcomingShootsWithoutCrew = await db
			.select({
				id: shoots.id,
				name: shoots.name,
				bookingId: shoots.bookingId,
				shootDate: shoots.shootDate,
				createdAt: shoots.createdAt,
			})
			.from(shoots)
			.innerJoin(bookings, eq(shoots.bookingId, bookings.id))
			.where(
				and(
					eq(shoots.organizationId, context.organizationId),
					isNull(shoots.deletedAt),
					gte(shoots.shootDate, todayStr),
					sql`${shoots.shootDate} <= ${addDays(todayStr, 14)}`, // Next 14 days
					sql`${shoots.status} NOT IN ('completed', 'cancelled')`,
					isNull(bookings.deletedAt),
				),
			)
			.orderBy(asc(shoots.shootDate))
			.limit(limit * 2); // Get more to filter

		for (const shoot of upcomingShootsWithoutCrew) {
			// Check if shoot has any assignments
			const assignments = await db
				.select({ id: shootAssignments.id })
				.from(shootAssignments)
				.where(eq(shootAssignments.shootId, shoot.id))
				.limit(1);

			if (assignments.length === 0) {
				actions.push({
					type: "upcoming_shoot_unassigned",
					title: `Unassigned shoot: ${shoot.name}`,
					description: `Scheduled for ${shoot.shootDate} - no crew assigned`,
					priority: "medium",
					entityType: "shoot",
					entityId: shoot.id,
					bookingId: shoot.bookingId,
					dueDate: shoot.shootDate,
					createdAt: shoot.createdAt.toISOString(),
				});
			}

			// Stop if we have enough
			if (
				actions.filter((a) => a.type === "upcoming_shoot_unassigned")
					.length >= limit
			) {
				break;
			}
		}

		// Sort actions by priority and date
		actions.sort((a, b) => {
			const priorityOrder = { high: 0, medium: 1, low: 2 };
			const priorityDiff =
				priorityOrder[a.priority] - priorityOrder[b.priority];
			if (priorityDiff !== 0) return priorityDiff;

			// Then by due date (nulls last)
			if (a.dueDate && b.dueDate) {
				return (
					new Date(a.dueDate).getTime() -
					new Date(b.dueDate).getTime()
				);
			}
			if (a.dueDate) return -1;
			if (b.dueDate) return 1;

			// Finally by creation date
			return (
				new Date(a.createdAt).getTime() -
				new Date(b.createdAt).getTime()
			);
		});

		const totalCount = actions.length;
		const limitedActions = actions.slice(0, limit);

		return {
			data: {
				actions: limitedActions,
				totalCount,
			},
		};
	});
