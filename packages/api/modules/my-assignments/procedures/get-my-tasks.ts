import {
	and,
	eq,
	isNull,
	gte,
	sql,
	count,
	asc,
	desc,
	ne,
	tasks,
	bookings,
	taskAssignments,
	assignmentSubmissions,
	crews,
	db,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { createPaginationResponse } from "../../studio/schemas/common";
import {
	getMyTasksInputSchema,
	getMyTasksOutputSchema,
} from "../../studio/schemas/my-assignments";
import { getMyCrewId } from "../lib/get-my-crew";

export const getMyTasks = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/me/assignments/tasks",
		tags: ["My Assignments"],
		summary: "Get my tasks",
		description: "Get task assignments for the current crew member",
	})
	.input(getMyTasksInputSchema)
	.output(getMyTasksOutputSchema)
	.handler(async ({ input, context }) => {
		const {
			page,
			limit,
			sortBy,
			sortDirection,
			dueDateFrom,
			dueDateTo,
			status,
			priority,
			workflowStatus,
			bookingId,
			includeCompleted,
		} = input;

		const offset = (page - 1) * limit;

		// Get crew ID for current user
		const crewId = await getMyCrewId(context.user.id, context.organizationId);

		const today = new Date();
		today.setHours(0, 0, 0, 0);

		// Build where conditions
		const conditions = [
			eq(taskAssignments.crewId, crewId),
			eq(tasks.organizationId, context.organizationId),
			isNull(tasks.deletedAt),
		];

		if (dueDateFrom) {
			conditions.push(gte(tasks.dueDate, dueDateFrom));
		}

		if (dueDateTo) {
			conditions.push(sql`${tasks.dueDate} <= ${dueDateTo}`);
		}

		if (status) {
			conditions.push(eq(tasks.status, status));
		}

		if (priority) {
			conditions.push(eq(tasks.priority, priority));
		}

		if (workflowStatus) {
			conditions.push(eq(tasks.workflowStatus, workflowStatus));
		}

		if (bookingId) {
			conditions.push(eq(tasks.bookingId, bookingId));
		}

		if (!includeCompleted) {
			conditions.push(sql`${tasks.workflowStatus} != 'approved'`);
		}

		// Sorting
		const sortColumnMap = {
			dueDate: tasks.dueDate,
			priority: tasks.priority,
			workflowStatus: tasks.workflowStatus,
			createdAt: tasks.createdAt,
		};
		const sortColumn = sortColumnMap[sortBy as keyof typeof sortColumnMap] ?? tasks.dueDate;

		// Handle null due dates (put them at the end when sorting ascending)
		let orderBy;
		if (sortBy === "dueDate") {
			orderBy =
				sortDirection === "asc"
					? [sql`CASE WHEN ${tasks.dueDate} IS NULL THEN 1 ELSE 0 END`, asc(sortColumn)]
					: [desc(sortColumn)];
		} else {
			orderBy = sortDirection === "asc" ? [asc(sortColumn)] : [desc(sortColumn)];
		}

		// Get assignments with task info
		const assignmentsList = await db
			.select({
				assignmentId: taskAssignments.id,
				taskId: tasks.id,
				name: tasks.name,
				description: tasks.description,
				status: tasks.status,
				priority: tasks.priority,
				workflowStatus: tasks.workflowStatus,
				dueDate: tasks.dueDate,
				bookingId: tasks.bookingId,
			})
			.from(taskAssignments)
			.innerJoin(tasks, eq(taskAssignments.taskId, tasks.id))
			.where(and(...conditions))
			.orderBy(...orderBy)
			.limit(limit)
			.offset(offset);

		// Get total count
		const [countResult] = await db
			.select({ count: count() })
			.from(taskAssignments)
			.innerJoin(tasks, eq(taskAssignments.taskId, tasks.id))
			.where(and(...conditions));

		const total = countResult?.count ?? 0;

		// Enrich with booking info, submissions, and other crew
		const enrichedAssignments = await Promise.all(
			assignmentsList.map(async (assignment) => {
				// Get booking info
				const booking = await db.query.bookings.findFirst({
					where: eq(bookings.id, assignment.bookingId),
					columns: {
						id: true,
						name: true,
						referenceNumber: true,
						status: true,
					},
				});

				// Get latest submission by this crew member
				const latestSubmission = await db.query.assignmentSubmissions.findFirst({
					where: and(
						eq(assignmentSubmissions.taskId, assignment.taskId),
						eq(assignmentSubmissions.submittedBy, crewId),
					),
					orderBy: [desc(assignmentSubmissions.submittedAt)],
					columns: {
						id: true,
						status: true,
						submittedAt: true,
						reviewNote: true,
					},
				});

				// Get other crew on this task
				const otherCrew = await db
					.select({
						crewId: taskAssignments.crewId,
						name: crews.name,
					})
					.from(taskAssignments)
					.innerJoin(crews, eq(taskAssignments.crewId, crews.id))
					.where(
						and(
							eq(taskAssignments.taskId, assignment.taskId),
							ne(taskAssignments.crewId, crewId),
						),
					);

				const isOverdue = assignment.dueDate
					? new Date(assignment.dueDate) < today
					: false;

				return {
					id: assignment.assignmentId,
					taskId: assignment.taskId,
					name: assignment.name,
					description: assignment.description,
					status: assignment.status,
					priority: assignment.priority,
					workflowStatus: assignment.workflowStatus,
					dueDate: assignment.dueDate,
					isOverdue,
					booking: {
						id: booking?.id ?? "",
						name: booking?.name ?? "Unknown",
						referenceNumber: booking?.referenceNumber ?? "",
						status: booking?.status ?? "new",
					},
					latestSubmission: latestSubmission
						? {
								id: latestSubmission.id,
								status: latestSubmission.status,
								submittedAt: latestSubmission.submittedAt?.toISOString() ?? null,
								reviewNote: latestSubmission.reviewNote,
							}
						: null,
					otherCrew: otherCrew.map((c) => ({
						id: c.crewId,
						name: c.name,
					})),
				};
			}),
		);

		return {
			data: enrichedAssignments,
			pagination: createPaginationResponse(page, limit, total),
		};
	});
