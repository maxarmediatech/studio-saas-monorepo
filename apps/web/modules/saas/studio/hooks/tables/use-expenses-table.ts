"use client";

import { parseAsArrayOf, parseAsString } from "nuqs";
import { useDataTable } from "@/modules/saas/shared/hooks/use-data-table";

/**
 * Bill To options for filter
 * Matches billToSchema in packages/api/modules/studio/schemas/common.ts
 */
const BILL_TO_OPTIONS = ["studio", "client"] as const;

/**
 * Payment methods for filter options
 * Matches paymentMethodSchema in packages/api/modules/studio/schemas/common.ts
 */
const PAYMENT_METHODS = [
	"cash",
	"upi",
	"bank_transfer",
	"cheque",
	"card",
	"other",
] as const;

/**
 * Filter state for expenses table
 */
export interface ExpenseFilters {
	search?: string | null;
	category?: string[] | null;
	billTo?: string[] | null;
	paymentMethod?: string[] | null;
	bookingId?: string | null;
}

/**
 * nuqs parsers for expense-specific filters
 * Using comma separator for array values
 */
const expenseFilterParsers = {
	category: parseAsArrayOf(parseAsString, ","),
	billTo: parseAsArrayOf(parseAsString, ","),
	paymentMethod: parseAsArrayOf(parseAsString, ","),
	bookingId: parseAsString,
};

/**
 * Hook for managing expenses table state with URL synchronization.
 *
 * @example
 * ```tsx
 * const {
 *   filters,
 *   pagination,
 *   sorting,
 *   setFilter,
 *   onPaginationChange,
 *   onSortingChange,
 * } = useExpensesTable();
 *
 * // Use in query
 * const { data } = useQuery(expensesApi.listOptions({
 *   page: pagination.page,
 *   limit: pagination.limit,
 *   search: filters.search ?? undefined,
 *   category: filters.category?.[0] ?? undefined, // API expects single value
 *   billTo: filters.billTo?.[0] ?? undefined, // API expects single value
 *   paymentMethod: filters.paymentMethod?.[0] ?? undefined, // API expects single value
 *   sortBy: sorting.sortBy ?? "expenseDate",
 *   sortDirection: sorting.sortDirection,
 * }));
 * ```
 */
export function useExpensesTable() {
	return useDataTable<ExpenseFilters>(expenseFilterParsers, {
		columnVisibilityKey: "expense",
		defaultSortBy: "expenseDate",
		defaultSortDirection: "desc",
		defaultLimit: 10,
	});
}

export { BILL_TO_OPTIONS, PAYMENT_METHODS };
