import { and, count, eq, gte, isNull, sql, tasks, db } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	getTaskStatsInputSchema,
	getTaskStatsOutputSchema,
} from "../../studio/schemas/task";

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

export const getTaskStats = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/tasks/stats",
		tags: ["Tasks"],
		summary: "Get task statistics",
		description: "Get aggregate statistics about tasks",
	})
	.input(getTaskStatsInputSchema)
	.output(getTaskStatsOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "task", "list");

		const { bookingId } = input;

		const baseConditions = [
			eq(tasks.organizationId, context.organizationId),
			isNull(tasks.deletedAt),
		];

		if (bookingId) {
			baseConditions.push(eq(tasks.bookingId, bookingId));
		}

		// Total tasks
		const [totalResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(tasks)
			.where(and(...baseConditions));

		// Tasks by status
		const statusCounts = await db
			.select({
				status: tasks.status,
				count: count().mapWith(Number),
			})
			.from(tasks)
			.where(and(...baseConditions))
			.groupBy(tasks.status);

		const byStatus: Record<string, number> = {};
		for (const row of statusCounts) {
			byStatus[row.status] = row.count;
		}

		// Tasks by priority
		const priorityCounts = await db
			.select({
				priority: tasks.priority,
				count: count().mapWith(Number),
			})
			.from(tasks)
			.where(and(...baseConditions))
			.groupBy(tasks.priority);

		const byPriority: Record<string, number> = {};
		for (const row of priorityCounts) {
			byPriority[row.priority] = row.count;
		}

		// Tasks by workflow status
		const workflowCounts = await db
			.select({
				workflowStatus: tasks.workflowStatus,
				count: count().mapWith(Number),
			})
			.from(tasks)
			.where(and(...baseConditions))
			.groupBy(tasks.workflowStatus);

		const byWorkflowStatus: Record<string, number> = {};
		for (const row of workflowCounts) {
			byWorkflowStatus[row.workflowStatus] = row.count;
		}

		// Overdue tasks (dueDate < today and not completed)
		const timeZone = normalizeTimeZone(context.membership.organization.timezone);
		const nowParts = getDateParts(new Date(), timeZone);
		const today = `${nowParts.year}-${nowParts.month}-${nowParts.day}`;

		const [overdueResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(tasks)
			.where(
				and(
					...baseConditions,
					sql`${tasks.dueDate} < ${today}`,
					sql`${tasks.workflowStatus} NOT IN ('approved')`,
				),
			);

		// Completed tasks
		const [completedResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(tasks)
			.where(
				and(
					...baseConditions,
					eq(tasks.workflowStatus, "approved"),
				),
			);

		// Tasks created this month (org timezone)
		const startOfMonth = `${nowParts.year}-${nowParts.month}-01`;

		const [thisMonthResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(tasks)
			.where(
				and(
					...baseConditions,
					gte(sql`DATE(${tasks.createdAt} AT TIME ZONE ${timeZone})`, startOfMonth),
				),
			);

		return {
			data: {
				totalTasks: totalResult?.count ?? 0,
				byStatus,
				byPriority,
				byWorkflowStatus,
				overdueTasks: overdueResult?.count ?? 0,
				completedTasks: completedResult?.count ?? 0,
				tasksThisMonth: thisMonthResult?.count ?? 0,
			},
		};
	});
