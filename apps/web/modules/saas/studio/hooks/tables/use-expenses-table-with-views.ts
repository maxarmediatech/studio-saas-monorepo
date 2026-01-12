"use client";

import { parseAsArrayOf, parseAsString } from "nuqs";
import { useDataTableWithViews } from "@/modules/saas/shared/hooks/use-data-table";

export interface ExpenseFilters {
	search?: string | null;
	category?: string[] | null;
	billTo?: string[] | null;
	paymentMethod?: string[] | null;
}

const expenseFilterParsers = {
	category: parseAsArrayOf(parseAsString, ","),
	billTo: parseAsArrayOf(parseAsString, ","),
	paymentMethod: parseAsArrayOf(parseAsString, ","),
};

export function useExpensesTableWithViews() {
	return useDataTableWithViews<ExpenseFilters>(expenseFilterParsers, {
		entityType: "expense",
		defaultSortBy: "expenseDate",
		defaultSortDirection: "desc",
		defaultLimit: 10,
	});
}
