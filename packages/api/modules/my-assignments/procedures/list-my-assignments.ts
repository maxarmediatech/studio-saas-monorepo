import {
	and,
	asc,
	assignmentSubmissions,
	bookings,
	count,
	db,
	deliverableAssignments,
	deliverables,
	eq,
	gte,
	isNull,
	shootAssignments,
	shoots,
	sql,
	taskAssignments,
	tasks,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	addDays,
	formatDateParts,
	getDateParts,
	normalizeTimeZone,
} from "../../studio/lib/date-helpers";
import {
	listMyAssignmentsInputSchema,
	listMyAssignmentsOutputSchema,
} from "../../studio/schemas/my-assignments";
import { getMyCrewId } from "../lib/get-my-crew";

export const listMyAssignments = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/me/assignments",
		tags: ["My Assignments"],
		summary: "List my assignments",
		description:
			"Get overview of all assignments for the current crew member",
	})
	.input(listMyAssignmentsInputSchema)
	.output(listMyAssignmentsOutputSchema)
	.handler(async ({ input, context }) => {
		// No permission check - users can always see their own assignments
		const { includeCompleted } = input;

		// Get crew ID for current user
		const crewId = await getMyCrewId(
			context.user.id,
			context.organizationId,
		);

		const headerTimeZone = context.headers.get("x-user-timezone");
		const timeZone = normalizeTimeZone(
			headerTimeZone ??
				context.user.timezone ??
				context.membership.organization.timezone,
		);
		const nowParts = getDateParts(new Date(), timeZone);
		const todayStr = formatDateParts(nowParts);

		// Count upcoming shoots
		const [upcomingShootsResult] = await db
			.select({ count: count() })
			.from(shootAssignments)
			.innerJoin(shoots, eq(shootAssignments.shootId, shoots.id))
			.where(
				and(
					eq(shootAssignments.crewId, crewId),
					eq(shoots.organizationId, context.organizationId),
					isNull(shoots.deletedAt),
					gte(shoots.shootDate, todayStr),
				),
			);

		// Count active tasks
		const taskConditions = [
			eq(taskAssignments.crewId, crewId),
			eq(tasks.organizationId, context.organizationId),
			isNull(tasks.deletedAt),
		];
		if (!includeCompleted) {
			taskConditions.push(sql`${tasks.workflowStatus} != 'approved'`);
		}

		const [activeTasksResult] = await db
			.select({ count: count() })
			.from(taskAssignments)
			.innerJoin(tasks, eq(taskAssignments.taskId, tasks.id))
			.where(and(...taskConditions));

		// Count active deliverables
		const deliverableConditions = [
			eq(deliverableAssignments.crewId, crewId),
			eq(deliverables.organizationId, context.organizationId),
			isNull(deliverables.deletedAt),
		];
		if (!includeCompleted) {
			deliverableConditions.push(
				sql`${deliverables.workflowStatus} != 'approved'`,
			);
		}

		const [activeDeliverablesResult] = await db
			.select({ count: count() })
			.from(deliverableAssignments)
			.innerJoin(
				deliverables,
				eq(deliverableAssignments.deliverableId, deliverables.id),
			)
			.where(and(...deliverableConditions));

		// Count pending submissions by this crew member
		const [pendingSubmissionsResult] = await db
			.select({ count: count() })
			.from(assignmentSubmissions)
			.where(
				and(
					eq(
						assignmentSubmissions.organizationId,
						context.organizationId,
					),
					eq(assignmentSubmissions.submittedBy, crewId),
					sql`${assignmentSubmissions.status} IN ('submitted', 'in_review')`,
				),
			);

		// Count overdue items
		const [overdueTasksResult] = await db
			.select({ count: count() })
			.from(taskAssignments)
			.innerJoin(tasks, eq(taskAssignments.taskId, tasks.id))
			.where(
				and(
					eq(taskAssignments.crewId, crewId),
					eq(tasks.organizationId, context.organizationId),
					isNull(tasks.deletedAt),
					sql`${tasks.workflowStatus} NOT IN ('approved')`,
					sql`${tasks.dueDate} < ${todayStr}`,
				),
			);

		const [overdueDeliverablesResult] = await db
			.select({ count: count() })
			.from(deliverableAssignments)
			.innerJoin(
				deliverables,
				eq(deliverableAssignments.deliverableId, deliverables.id),
			)
			.where(
				and(
					eq(deliverableAssignments.crewId, crewId),
					eq(deliverables.organizationId, context.organizationId),
					isNull(deliverables.deletedAt),
					sql`${deliverables.workflowStatus} NOT IN ('approved')`,
					sql`${deliverables.dueDate} < ${todayStr}`,
				),
			);

		const overdueItems =
			(overdueTasksResult?.count ?? 0) +
			(overdueDeliverablesResult?.count ?? 0);

		// Get next shoot
		const nextShootAssignment = await db
			.select({
				shootId: shoots.id,
				name: shoots.name,
				shootDate: shoots.shootDate,
				startTime: shoots.startTime,
				venue: shoots.venue,
				bookingId: shoots.bookingId,
			})
			.from(shootAssignments)
			.innerJoin(shoots, eq(shootAssignments.shootId, shoots.id))
			.where(
				and(
					eq(shootAssignments.crewId, crewId),
					eq(shoots.organizationId, context.organizationId),
					isNull(shoots.deletedAt),
					gte(shoots.shootDate, todayStr),
				),
			)
			.orderBy(asc(shoots.shootDate), asc(shoots.startTime))
			.limit(1);

		let nextShoot = null;
		if (nextShootAssignment.length > 0) {
			const shoot = nextShootAssignment[0];
			const booking = await db.query.bookings.findFirst({
				where: eq(bookings.id, shoot.bookingId),
				columns: { name: true },
			});

			nextShoot = {
				id: shoot.shootId,
				title: shoot.name,
				shootDate: shoot.shootDate,
				startTime: shoot.startTime,
				location: shoot.venue,
				bookingName: booking?.name ?? "Unknown",
			};
		}

		// Get urgent tasks (overdue or due within 7 days)
		const sevenDaysLater = addDays(todayStr, 7);

		const urgentTasksList = await db
			.select({
				taskId: tasks.id,
				name: tasks.name,
				dueDate: tasks.dueDate,
				workflowStatus: tasks.workflowStatus,
				bookingId: tasks.bookingId,
			})
			.from(taskAssignments)
			.innerJoin(tasks, eq(taskAssignments.taskId, tasks.id))
			.where(
				and(
					eq(taskAssignments.crewId, crewId),
					eq(tasks.organizationId, context.organizationId),
					isNull(tasks.deletedAt),
					sql`${tasks.workflowStatus} NOT IN ('approved')`,
					sql`${tasks.dueDate} IS NOT NULL AND ${tasks.dueDate} <= ${sevenDaysLater}`,
				),
			)
			.orderBy(asc(tasks.dueDate))
			.limit(5);

		const urgentTasks = await Promise.all(
			urgentTasksList.map(async (task) => {
				const booking = await db.query.bookings.findFirst({
					where: eq(bookings.id, task.bookingId),
					columns: { name: true },
				});

				return {
					id: task.taskId,
					name: task.name,
					dueDate: task.dueDate,
					isOverdue: task.dueDate ? task.dueDate < todayStr : false,
					workflowStatus: task.workflowStatus,
					bookingName: booking?.name ?? "Unknown",
				};
			}),
		);

		// Get urgent deliverables (overdue or due within 7 days)
		const urgentDeliverablesList = await db
			.select({
				deliverableId: deliverables.id,
				name: deliverables.name,
				dueDate: deliverables.dueDate,
				workflowStatus: deliverables.workflowStatus,
				bookingId: deliverables.bookingId,
			})
			.from(deliverableAssignments)
			.innerJoin(
				deliverables,
				eq(deliverableAssignments.deliverableId, deliverables.id),
			)
			.where(
				and(
					eq(deliverableAssignments.crewId, crewId),
					eq(deliverables.organizationId, context.organizationId),
					isNull(deliverables.deletedAt),
					sql`${deliverables.workflowStatus} NOT IN ('approved')`,
					sql`${deliverables.dueDate} IS NOT NULL AND ${deliverables.dueDate} <= ${sevenDaysLater}`,
				),
			)
			.orderBy(asc(deliverables.dueDate))
			.limit(5);

		const urgentDeliverables = await Promise.all(
			urgentDeliverablesList.map(async (deliverable) => {
				const booking = await db.query.bookings.findFirst({
					where: eq(bookings.id, deliverable.bookingId),
					columns: { name: true },
				});

				return {
					id: deliverable.deliverableId,
					name: deliverable.name,
					dueDate: deliverable.dueDate,
					isOverdue: deliverable.dueDate
						? deliverable.dueDate < todayStr
						: false,
					workflowStatus: deliverable.workflowStatus,
					bookingName: booking?.name ?? "Unknown",
				};
			}),
		);

		return {
			data: {
				summary: {
					upcomingShoots: upcomingShootsResult?.count ?? 0,
					activeTasks: activeTasksResult?.count ?? 0,
					activeDeliverables: activeDeliverablesResult?.count ?? 0,
					pendingSubmissions: pendingSubmissionsResult?.count ?? 0,
					overdueItems,
				},
				nextShoot,
				urgentTasks,
				urgentDeliverables,
			},
		};
	});
