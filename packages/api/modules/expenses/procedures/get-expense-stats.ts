import {
	and,
	count,
	db,
	eq,
	expenseAssignments,
	expenses,
	gte,
	isNull,
	sql,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	getExpenseStatsInputSchema,
	getExpenseStatsOutputSchema,
} from "../../studio/schemas/expense";

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

export const getExpenseStats = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/expenses/stats",
		tags: ["Expenses"],
		summary: "Get expense statistics",
		description: "Get aggregate statistics about expenses",
	})
	.input(getExpenseStatsInputSchema)
	.output(getExpenseStatsOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "expense", "list");

		const { bookingId, dateFrom, dateTo } = input;

		const timeZone = normalizeTimeZone(
			context.membership.organization.timezone,
		);
		const nowParts = getDateParts(new Date(), timeZone);
		const startOfMonth = `${nowParts.year}-${nowParts.month}-01`;

		// Build base conditions
		const baseConditions = [
			eq(expenses.organizationId, context.organizationId),
			isNull(expenses.deletedAt),
		];

		if (dateFrom) {
			baseConditions.push(gte(expenses.expenseDate, dateFrom));
		}

		if (dateTo) {
			baseConditions.push(sql`${expenses.expenseDate} <= ${dateTo}`);
		}

		// If filtering by booking, get expense IDs linked to that booking
		let expenseIdsForBooking: string[] | null = null;
		if (bookingId) {
			const assignedExpenses = await db
				.select({ expenseId: expenseAssignments.expenseId })
				.from(expenseAssignments)
				.where(eq(expenseAssignments.bookingId, bookingId));

			expenseIdsForBooking = assignedExpenses.map((e) => e.expenseId);

			if (expenseIdsForBooking.length === 0) {
				// No expenses for this booking
				return {
					data: {
						totalExpenses: "0",
						expensesThisMonth: "0",
						byCategory: {},
						byBillTo: {},
						byPaymentMethod: {},
						expenseCount: 0,
						averageExpense: "0",
					},
				};
			}

			baseConditions.push(
				sql`${expenses.id} IN (${sql.join(
					expenseIdsForBooking.map((id) => sql`${id}`),
					sql`, `,
				)})`,
			);
		}

		// Total expenses
		const [totalResult] = await db
			.select({
				sum: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
				count: count().mapWith(Number),
			})
			.from(expenses)
			.where(and(...baseConditions));

		const totalExpenses = totalResult?.sum ?? "0";
		const expenseCount = totalResult?.count ?? 0;
		const averageExpense =
			expenseCount > 0
				? (Number.parseFloat(totalExpenses) / expenseCount).toFixed(2)
				: "0";

		// Expenses this month
		const thisMonthConditions = [
			...baseConditions,
			gte(expenses.expenseDate, startOfMonth),
		];
		const [thisMonthResult] = await db
			.select({ sum: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` })
			.from(expenses)
			.where(and(...thisMonthConditions));

		// By category
		const categoryCounts = await db
			.select({
				category: expenses.category,
				sum: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
			})
			.from(expenses)
			.where(and(...baseConditions))
			.groupBy(expenses.category);

		const byCategory: Record<string, string> = {};
		for (const row of categoryCounts) {
			const key = row.category ?? "uncategorized";
			byCategory[key] = row.sum;
		}

		// By billTo
		const billToCounts = await db
			.select({
				billTo: expenses.billTo,
				sum: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
			})
			.from(expenses)
			.where(and(...baseConditions))
			.groupBy(expenses.billTo);

		const byBillTo: Record<string, string> = {};
		for (const row of billToCounts) {
			byBillTo[row.billTo] = row.sum;
		}

		// By payment method
		const methodCounts = await db
			.select({
				paymentMethod: expenses.paymentMethod,
				sum: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
			})
			.from(expenses)
			.where(and(...baseConditions))
			.groupBy(expenses.paymentMethod);

		const byPaymentMethod: Record<string, string> = {};
		for (const row of methodCounts) {
			const key = row.paymentMethod ?? "unspecified";
			byPaymentMethod[key] = row.sum;
		}

		return {
			data: {
				totalExpenses,
				expensesThisMonth: thisMonthResult?.sum ?? "0",
				byCategory,
				byBillTo,
				byPaymentMethod,
				expenseCount,
				averageExpense,
			},
		};
	});
