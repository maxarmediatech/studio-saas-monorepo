import {
	and,
	bookings,
	count,
	crews,
	db,
	eq,
	gte,
	inArray,
	isNull,
	sql,
	taskAssignments,
	tasks,
	users,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import { createPaginationResponse } from "../../studio/schemas/common";
import {
	listTasksInputSchema,
	listTasksOutputSchema,
} from "../../studio/schemas/task";

export const listTasks = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/tasks",
		tags: ["Tasks"],
		summary: "List tasks",
		description:
			"List all tasks for the organization with optional filters",
	})
	.input(listTasksInputSchema)
	.output(listTasksOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "task", "list");

		const {
			bookingId,
			status,
			priority,
			workflowStatus,
			dueDateFrom,
			dueDateTo,
			crewId,
			search,
			sortBy,
			sortDirection,
			page,
			limit,
			includeDeleted,
		} = input;
		const offset = (page - 1) * limit;

		const normalizeMultiValue = (
			value: string | string[] | null | undefined,
		): string[] | null => {
			if (!value) {
				return null;
			}

			const raw = Array.isArray(value) ? value : [value];
			const parts = raw
				.flatMap((v) => v.split(","))
				.map((v) => v.trim())
				.filter(Boolean);

			return parts.length > 0 ? parts : null;
		};

		// Build where conditions
		const conditions = [eq(tasks.organizationId, context.organizationId)];

		if (!includeDeleted) {
			conditions.push(isNull(tasks.deletedAt));
		}

		if (bookingId) {
			conditions.push(eq(tasks.bookingId, bookingId));
		}

		const statuses = normalizeMultiValue(status);
		if (statuses) {
			conditions.push(inArray(tasks.status, statuses));
		}

		const priorities = normalizeMultiValue(priority);
		if (priorities) {
			conditions.push(inArray(tasks.priority, priorities));
		}

		if (workflowStatus) {
			conditions.push(eq(tasks.workflowStatus, workflowStatus));
		}

		if (dueDateFrom) {
			conditions.push(gte(tasks.dueDate, dueDateFrom));
		}

		if (dueDateTo) {
			conditions.push(sql`${tasks.dueDate} <= ${dueDateTo}`);
		}

		if (search) {
			conditions.push(
				sql`(${tasks.name} ILIKE ${`%${search}%`} OR ${tasks.description} ILIKE ${`%${search}%`})`,
			);
		}

		// Filter by crew assignment if specified
		let taskIdsFromCrew: string[] | null = null;
		if (crewId) {
			const crewAssignments = await db
				.select({ taskId: taskAssignments.taskId })
				.from(taskAssignments)
				.where(eq(taskAssignments.crewId, crewId));

			taskIdsFromCrew = crewAssignments.map((a) => a.taskId);

			if (taskIdsFromCrew.length === 0) {
				return {
					data: [],
					pagination: createPaginationResponse(page, limit, 0),
				};
			}

			conditions.push(
				sql`${tasks.id} IN (${sql.join(
					taskIdsFromCrew.map((id) => sql`${id}`),
					sql`, `,
				)})`,
			);
		}

		// Get total count
		const [countResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(tasks)
			.where(and(...conditions));

		const total = countResult?.count ?? 0;

		// Get sorting column
		const orderColumn =
			sortBy === "name"
				? tasks.name
				: sortBy === "status"
					? tasks.status
					: sortBy === "priority"
						? tasks.priority
						: sortBy === "workflowStatus"
							? tasks.workflowStatus
							: sortBy === "createdAt"
								? tasks.createdAt
								: tasks.dueDate;

		// Get tasks with booking info
		const data = await db
			.select({
				task: tasks,
				bookingName: bookings.name,
				bookingReferenceNumber: bookings.referenceNumber,
			})
			.from(tasks)
			.innerJoin(bookings, eq(tasks.bookingId, bookings.id))
			.where(and(...conditions))
			.orderBy(
				sortDirection === "asc"
					? sql`${orderColumn} ASC`
					: sql`${orderColumn} DESC`,
			)
			.limit(limit)
			.offset(offset);

		// Get assignment counts
		const taskIds = data.map((d) => d.task.id);
		const assignmentCounts: Record<string, number> = {};
		const assignedCrewByTask: Record<
			string,
			{ id: string; name: string; avatarUrl: string | null }[]
		> = {};

		if (taskIds.length > 0) {
			const assignmentResults = await db
				.select({
					taskId: taskAssignments.taskId,
					crewId: crews.id,
					crewName: crews.name,
					avatarUrl: users.image,
				})
				.from(taskAssignments)
				.innerJoin(crews, eq(taskAssignments.crewId, crews.id))
				.leftJoin(users, eq(crews.userId, users.id))
				.where(
					and(
						inArray(taskAssignments.taskId, taskIds),
						isNull(crews.deletedAt),
					),
				);

			for (const row of assignmentResults) {
				assignmentCounts[row.taskId] =
					(assignmentCounts[row.taskId] ?? 0) + 1;
				if (!assignedCrewByTask[row.taskId]) {
					assignedCrewByTask[row.taskId] = [];
				}
				assignedCrewByTask[row.taskId].push({
					id: row.crewId,
					name: row.crewName,
					avatarUrl: row.avatarUrl,
				});
			}
		}

		return {
			data: data.map(({ task, bookingName, bookingReferenceNumber }) => ({
				...task,
				dueDate: task.dueDate ?? null,
				completedAt: task.completedAt?.toISOString() ?? null,
				metadata: task.metadata as Record<string, unknown> | null,
				createdAt: task.createdAt.toISOString(),
				updatedAt: task.updatedAt.toISOString(),
				deletedAt: task.deletedAt?.toISOString() ?? null,
				assignmentsCount: assignmentCounts[task.id] ?? 0,
				assignedCrew: assignedCrewByTask[task.id] ?? [],
				bookingName,
				bookingReferenceNumber,
			})),
			pagination: createPaginationResponse(page, limit, total),
		};
	});
