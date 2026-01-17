import { and, db, desc, eq, expenses, isNull } from "@repo/database";
import type { ExpenseSearchResult } from "../../types";
import { buildTextSearchCondition } from "../search-utils";

export async function searchExpenses(
	organizationId: string,
	query: string,
	limit: number,
): Promise<ExpenseSearchResult[]> {
	const conditions = [
		eq(expenses.organizationId, organizationId),
		isNull(expenses.deletedAt),
	];

	const textSearch = buildTextSearchCondition(
		query,
		expenses.description,
		expenses.vendor,
		expenses.category,
	);

	if (textSearch) {
		conditions.push(textSearch);
	}

	const results = await db
		.select({
			id: expenses.id,
			description: expenses.description,
			amount: expenses.amount,
			expenseDate: expenses.expenseDate,
			category: expenses.category,
		})
		.from(expenses)
		.where(and(...conditions))
		.orderBy(desc(expenses.expenseDate))
		.limit(limit);

	return results;
}
