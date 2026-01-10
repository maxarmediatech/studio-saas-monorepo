import {
	and,
	asc,
	bookings,
	count,
	crews,
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
	getStartOfWeek,
	normalizeTimeZone,
} from "../../studio/lib/date-helpers";
import { requirePermission } from "../../studio/lib/permissions";
import {
	getOperationsInputSchema,
	getOperationsOutputSchema,
} from "../../studio/schemas/dashboard";

export const getOperations = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/dashboard/operations",
		tags: ["Dashboard"],
		summary: "Get operations",
		description:
			"Get operational data including upcoming shoots, pending tasks, and deliverables",
	})
	.input(getOperationsInputSchema)
	.output(getOperationsOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "booking", "read");

		const { limit } = input;

		const timeZone = normalizeTimeZone(
			context.membership.organization.timezone,
		);
		const nowParts = getDateParts(new Date(), timeZone);
		const todayStr = formatDateParts(nowParts);
		const startOfWeek = getStartOfWeek(nowParts);
		const endOfWeek = addDays(startOfWeek, 7);

		// Upcoming shoots with crew assignments
		const upcomingShootsList = await db
			.select({
				id: shoots.id,
				name: shoots.name,
				bookingId: shoots.bookingId,
				shootDate: shoots.shootDate,
				startTime: shoots.startTime,
				endTime: shoots.endTime,
				venue: shoots.venue,
				status: shoots.status,
			})
			.from(shoots)
			.where(
				and(
					eq(shoots.organizationId, context.organizationId),
					isNull(shoots.deletedAt),
					gte(shoots.shootDate, todayStr),
					sql`${shoots.status} NOT IN ('completed', 'cancelled')`,
				),
			)
			.orderBy(asc(shoots.shootDate), asc(shoots.startTime))
			.limit(limit);

		// Get crew assignments for each shoot
		const upcomingShootsWithCrew = await Promise.all(
			upcomingShootsList.map(async (shoot) => {
				const booking = await db.query.bookings.findFirst({
					where: eq(bookings.id, shoot.bookingId),
					columns: { name: true, referenceNumber: true },
				});

				const assignments = await db
					.select({
						crewId: shootAssignments.crewId,
						role: shootAssignments.role,
						isLead: shootAssignments.isLead,
						crewName: crews.name,
					})
					.from(shootAssignments)
					.innerJoin(crews, eq(shootAssignments.crewId, crews.id))
					.where(eq(shootAssignments.shootId, shoot.id));

				return {
					id: shoot.id,
					title: shoot.name,
					bookingId: shoot.bookingId,
					bookingName: booking?.name ?? "Unknown",
					bookingReferenceNumber: booking?.referenceNumber ?? "",
					shootDate: shoot.shootDate,
					startTime: shoot.startTime,
					endTime: shoot.endTime,
					location: shoot.venue,
					status: shoot.status,
					assignedCrew: assignments.map((a) => ({
						id: a.crewId,
						name: a.crewName,
						role: a.role,
						isLead: a.isLead,
					})),
				};
			}),
		);

		// Pending tasks
		const pendingTasksList = await db
			.select({
				id: tasks.id,
				name: tasks.name,
				bookingId: tasks.bookingId,
				dueDate: tasks.dueDate,
				priority: tasks.priority,
				workflowStatus: tasks.workflowStatus,
			})
			.from(tasks)
			.where(
				and(
					eq(tasks.organizationId, context.organizationId),
					isNull(tasks.deletedAt),
					sql`${tasks.workflowStatus} IN ('not_started', 'assigned', 'revision_requested')`,
				),
			)
			.orderBy(
				sql`CASE WHEN ${tasks.dueDate} IS NULL THEN 1 ELSE 0 END`,
				asc(tasks.dueDate),
			)
			.limit(limit);

		// Get crew assignments for each task
		const pendingTasksWithCrew = await Promise.all(
			pendingTasksList.map(async (task) => {
				const booking = await db.query.bookings.findFirst({
					where: eq(bookings.id, task.bookingId),
					columns: { name: true },
				});

				const assignments = await db
					.select({
						crewId: taskAssignments.crewId,
						crewName: crews.name,
					})
					.from(taskAssignments)
					.innerJoin(crews, eq(taskAssignments.crewId, crews.id))
					.where(eq(taskAssignments.taskId, task.id));

				const isOverdue = task.dueDate
					? task.dueDate < todayStr
					: false;

				return {
					id: task.id,
					name: task.name,
					bookingId: task.bookingId,
					bookingName: booking?.name ?? "Unknown",
					dueDate: task.dueDate,
					priority: task.priority,
					workflowStatus: task.workflowStatus,
					isOverdue,
					assignedCrew: assignments.map((a) => ({
						id: a.crewId,
						name: a.crewName,
					})),
				};
			}),
		);

		// Pending deliverables
		const pendingDeliverablesList = await db
			.select({
				id: deliverables.id,
				name: deliverables.name,
				bookingId: deliverables.bookingId,
				dueDate: deliverables.dueDate,
				workflowStatus: deliverables.workflowStatus,
			})
			.from(deliverables)
			.where(
				and(
					eq(deliverables.organizationId, context.organizationId),
					isNull(deliverables.deletedAt),
					sql`${deliverables.workflowStatus} IN ('not_started', 'assigned', 'revision_requested')`,
				),
			)
			.orderBy(
				sql`CASE WHEN ${deliverables.dueDate} IS NULL THEN 1 ELSE 0 END`,
				asc(deliverables.dueDate),
			)
			.limit(limit);

		// Get crew assignments for each deliverable
		const pendingDeliverablesWithCrew = await Promise.all(
			pendingDeliverablesList.map(async (deliverable) => {
				const booking = await db.query.bookings.findFirst({
					where: eq(bookings.id, deliverable.bookingId),
					columns: { name: true },
				});

				const assignments = await db
					.select({
						crewId: deliverableAssignments.crewId,
						crewName: crews.name,
					})
					.from(deliverableAssignments)
					.innerJoin(
						crews,
						eq(deliverableAssignments.crewId, crews.id),
					)
					.where(
						eq(
							deliverableAssignments.deliverableId,
							deliverable.id,
						),
					);

				const isOverdue = deliverable.dueDate
					? deliverable.dueDate < todayStr
					: false;

				return {
					id: deliverable.id,
					name: deliverable.name,
					bookingId: deliverable.bookingId,
					bookingName: booking?.name ?? "Unknown",
					dueDate: deliverable.dueDate,
					workflowStatus: deliverable.workflowStatus,
					isOverdue,
					assignedCrew: assignments.map((a) => ({
						id: a.crewId,
						name: a.crewName,
					})),
				};
			}),
		);

		// Counts
		const [shootsThisWeekResult] = await db
			.select({ count: count() })
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

		const [overdueTasksResult] = await db
			.select({ count: count() })
			.from(tasks)
			.where(
				and(
					eq(tasks.organizationId, context.organizationId),
					isNull(tasks.deletedAt),
					sql`${tasks.workflowStatus} IN ('not_started', 'assigned', 'revision_requested')`,
					sql`${tasks.dueDate} < ${todayStr}`,
				),
			);

		const [overdueDeliverablesResult] = await db
			.select({ count: count() })
			.from(deliverables)
			.where(
				and(
					eq(deliverables.organizationId, context.organizationId),
					isNull(deliverables.deletedAt),
					sql`${deliverables.workflowStatus} IN ('not_started', 'assigned', 'revision_requested')`,
					sql`${deliverables.dueDate} < ${todayStr}`,
				),
			);

		return {
			data: {
				upcomingShoots: upcomingShootsWithCrew,
				pendingTasks: pendingTasksWithCrew,
				pendingDeliverables: pendingDeliverablesWithCrew,
				shootsThisWeek: shootsThisWeekResult?.count ?? 0,
				overdueTasksCount: overdueTasksResult?.count ?? 0,
				overdueDeliverablesCount: overdueDeliverablesResult?.count ?? 0,
			},
		};
	});
