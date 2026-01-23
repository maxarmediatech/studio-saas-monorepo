import { and, db, eq, expenses, ilike, isNull } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requireAnyPermission } from "../../studio/lib/permissions";
import { createPaginationResponse } from "../../studio/schemas/common";
import {
	type ExpenseMinimal,
	listExpensesMinimalInputSchema,
	listExpensesMinimalOutputSchema,
} from "../../studio/schemas/expense";

export const listExpensesMinimal = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/expenses/minimal",
		tags: ["Expenses"],
		summary: "List expenses (minimal)",
		description:
			"Lightweight list of expenses for dropdowns and references",
	})
	.input(listExpensesMinimalInputSchema)
	.output(listExpensesMinimalOutputSchema)
	.handler(async ({ input, context }) => {
		await requireAnyPermission(context, [
			{ resource: "expense", action: "list" },
			{ resource: "expense", action: "reference" },
		]);

		const { page, limit, search, bookingId } = input;
		const offset = (page - 1) * limit;

		const conditions = [
			eq(expenses.organizationId, context.organizationId),
			isNull(expenses.deletedAt),
		];

		if (search) {
			conditions.push(ilike(expenses.description, `%${search}%`));
		}

		const rows = await db
			.select({
				id: expenses.id,
				description: expenses.description,
				category: expenses.category,
				expenseDate: expenses.expenseDate,
				vendor: expenses.vendor,
			})
			.from(expenses)
			.where(and(...conditions))
			.orderBy(expenses.description)
			.limit(limit)
			.offset(offset);

		const data: ExpenseMinimal[] = rows.map((row) => ({
			id: row.id,
			description: row.description,
			category: row.category,
			expenseDate: row.expenseDate,
			vendor: row.vendor,
		}));

		const totalResult = await db
			.select({ count: db.$count(expenses) })
			.from(expenses)
			.where(and(...conditions));

		const total = totalResult[0]?.count ?? 0;

		return {
			data,
			pagination: createPaginationResponse(page, limit, total),
		};
	});
