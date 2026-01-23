import { and, db, eq, ilike, isNull, tasks } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requireAnyPermission } from "../../studio/lib/permissions";
import { createPaginationResponse } from "../../studio/schemas/common";
import {
	listTasksMinimalInputSchema,
	listTasksMinimalOutputSchema,
	type TaskMinimal,
} from "../../studio/schemas/task";

export const listTasksMinimal = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/tasks/minimal",
		tags: ["Tasks"],
		summary: "List tasks (minimal)",
		description: "Lightweight list of tasks for dropdowns and references",
	})
	.input(listTasksMinimalInputSchema)
	.output(listTasksMinimalOutputSchema)
	.handler(async ({ input, context }) => {
		await requireAnyPermission(context, [
			{ resource: "task", action: "list" },
			{ resource: "task", action: "reference" },
		]);

		const { page, limit, search, bookingId, workflowStatus } = input;
		const offset = (page - 1) * limit;

		const conditions = [
			eq(tasks.organizationId, context.organizationId),
			isNull(tasks.deletedAt),
		];

		if (bookingId) {
			conditions.push(eq(tasks.bookingId, bookingId));
		}

		if (workflowStatus) {
			conditions.push(eq(tasks.workflowStatus, workflowStatus));
		}

		if (search) {
			conditions.push(ilike(tasks.name, `%${search}%`));
		}

		const rows = await db
			.select({
				id: tasks.id,
				name: tasks.name,
				status: tasks.status,
				priority: tasks.priority,
				workflowStatus: tasks.workflowStatus,
				dueDate: tasks.dueDate,
				bookingId: tasks.bookingId,
			})
			.from(tasks)
			.where(and(...conditions))
			.orderBy(tasks.name)
			.limit(limit)
			.offset(offset);

		const data: TaskMinimal[] = rows.map((row) => ({
			id: row.id,
			name: row.name,
			status: row.status,
			priority: row.priority,
			workflowStatus: row.workflowStatus,
			dueDate: row.dueDate,
			bookingId: row.bookingId,
		}));

		const totalResult = await db
			.select({ count: db.$count(tasks) })
			.from(tasks)
			.where(and(...conditions));

		const total = totalResult[0]?.count ?? 0;

		return {
			data,
			pagination: createPaginationResponse(page, limit, total),
		};
	});
