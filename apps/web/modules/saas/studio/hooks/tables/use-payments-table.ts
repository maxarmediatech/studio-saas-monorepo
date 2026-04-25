"use client";

import { parseAsArrayOf, parseAsString } from "nuqs";
import { useDataTable } from "@/modules/saas/shared/hooks/use-data-table";

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
 * Filter state for payments table
 */
export interface PaymentFilters {
	search?: string | null;
	bookingId?: string | null;
	paymentMethod?: string[] | null;
}

/**
 * nuqs parsers for payment-specific filters
 * Using comma separator for array values
 */
const paymentFilterParsers = {
	bookingId: parseAsString,
	paymentMethod: parseAsArrayOf(parseAsString, ","),
};

/**
 * Hook for managing payments table state with URL synchronization.
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
 * } = usePaymentsTable();
 *
 * // Use in query
 * const { data } = useQuery(studioPaymentsApi.listReceivedOptions({
 *   page: pagination.page,
 *   limit: pagination.limit,
 *   search: filters.search ?? undefined,
 *   paymentMethod: filters.paymentMethod?.[0] ?? undefined, // API expects single value
 *   sortBy: sorting.sortBy ?? "receivedDate",
 *   sortDirection: sorting.sortDirection,
 * }));
 * ```
 */
export function usePaymentsTable() {
	return useDataTable<PaymentFilters>(paymentFilterParsers, {
		columnVisibilityKey: "payment",
		defaultSortBy: "receivedDate",
		defaultSortDirection: "desc",
		defaultLimit: 10,
	});
}

export { PAYMENT_METHODS };
