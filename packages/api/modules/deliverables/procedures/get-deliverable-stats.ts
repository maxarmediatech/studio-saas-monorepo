import { and, count, eq, gte, isNull, sql, deliverables, db } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	getDeliverableStatsInputSchema,
	getDeliverableStatsOutputSchema,
} from "../../studio/schemas/deliverable";

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

export const getDeliverableStats = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/deliverables/stats",
		tags: ["Deliverables"],
		summary: "Get deliverable statistics",
		description: "Get aggregate statistics about deliverables",
	})
	.input(getDeliverableStatsInputSchema)
	.output(getDeliverableStatsOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "deliverable", "list");

		const { bookingId } = input;

		const baseConditions = [
			eq(deliverables.organizationId, context.organizationId),
			isNull(deliverables.deletedAt),
		];

		if (bookingId) {
			baseConditions.push(eq(deliverables.bookingId, bookingId));
		}

		// Total deliverables
		const [totalResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(deliverables)
			.where(and(...baseConditions));

		// Deliverables by type
		const typeCounts = await db
			.select({
				deliverableType: deliverables.deliverableType,
				count: count().mapWith(Number),
			})
			.from(deliverables)
			.where(and(...baseConditions))
			.groupBy(deliverables.deliverableType);

		const byType: Record<string, number> = {};
		for (const row of typeCounts) {
			byType[row.deliverableType] = row.count;
		}

		// Deliverables by status
		const statusCounts = await db
			.select({
				status: deliverables.status,
				count: count().mapWith(Number),
			})
			.from(deliverables)
			.where(and(...baseConditions))
			.groupBy(deliverables.status);

		const byStatus: Record<string, number> = {};
		for (const row of statusCounts) {
			byStatus[row.status] = row.count;
		}

		// Deliverables by priority
		const priorityCounts = await db
			.select({
				priority: deliverables.priority,
				count: count().mapWith(Number),
			})
			.from(deliverables)
			.where(and(...baseConditions))
			.groupBy(deliverables.priority);

		const byPriority: Record<string, number> = {};
		for (const row of priorityCounts) {
			byPriority[row.priority] = row.count;
		}

		// Deliverables by workflow status
		const workflowCounts = await db
			.select({
				workflowStatus: deliverables.workflowStatus,
				count: count().mapWith(Number),
			})
			.from(deliverables)
			.where(and(...baseConditions))
			.groupBy(deliverables.workflowStatus);

		const byWorkflowStatus: Record<string, number> = {};
		for (const row of workflowCounts) {
			byWorkflowStatus[row.workflowStatus] = row.count;
		}

		// Overdue deliverables (dueDate < today and not approved)
		const timeZone = normalizeTimeZone(context.membership.organization.timezone);
		const nowParts = getDateParts(new Date(), timeZone);
		const today = `${nowParts.year}-${nowParts.month}-${nowParts.day}`;

		const [overdueResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(deliverables)
			.where(
				and(
					...baseConditions,
					sql`${deliverables.dueDate} < ${today}`,
					sql`${deliverables.workflowStatus} NOT IN ('approved')`,
				),
			);

		// Delivered deliverables (has deliveredAt timestamp)
		const [deliveredResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(deliverables)
			.where(
				and(
					...baseConditions,
					sql`${deliverables.deliveredAt} IS NOT NULL`,
				),
			);

		// Deliverables created this month (org timezone)
		const startOfMonth = `${nowParts.year}-${nowParts.month}-01`;

		const [thisMonthResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(deliverables)
			.where(
				and(
					...baseConditions,
					gte(sql`DATE(${deliverables.createdAt} AT TIME ZONE ${timeZone})`, startOfMonth),
				),
			);

		return {
			data: {
				totalDeliverables: totalResult?.count ?? 0,
				byType,
				byStatus,
				byPriority,
				byWorkflowStatus,
				overdueDeliverables: overdueResult?.count ?? 0,
				deliveredDeliverables: deliveredResult?.count ?? 0,
				deliverablesThisMonth: thisMonthResult?.count ?? 0,
			},
		};
	});
