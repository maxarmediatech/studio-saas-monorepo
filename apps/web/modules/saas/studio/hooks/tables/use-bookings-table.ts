"use client";

import type { BookingPhase } from "@repo/api/modules/studio/schemas/common";
import { parseAsArrayOf, parseAsStringLiteral } from "nuqs";
import { useDataTable } from "@/modules/saas/shared/hooks/use-data-table";

/**
 * Booking phases for filter validation
 */
const BOOKING_PHASES = [
	"new",
	"preparation",
	"shooting",
	"delivery",
	"completed",
	"cancelled",
] as const;

/**
 * Filter state for bookings table
 */
export interface BookingFilters {
	search?: string | null;
	statuses?: BookingPhase[] | null;
}

/**
 * nuqs parsers for booking-specific filters
 */
const bookingFilterParsers = {
	statuses: parseAsArrayOf(parseAsStringLiteral(BOOKING_PHASES)),
};

/**
 * Hook for managing bookings table state with URL synchronization.
 *
 * @example
 * ```tsx
 * const {
 *   filters,
 *   pagination,
 *   sorting,
 *   setFilter,
 *   onPaginationChange,
 * } = useBookingsTable();
 *
 * // Use in query
 * const { data } = useQuery(bookingsApi.listOptions({
 *   page: pagination.page,
 *   limit: pagination.limit,
 *   search: filters.search ?? undefined,
 *   status: filters.status ?? undefined,
 *   sortBy: sorting.sortBy ?? "createdAt",
 *   sortDirection: sorting.sortDirection,
 * }));
 * ```
 */
export function useBookingsTable() {
	return useDataTable<BookingFilters>(bookingFilterParsers, {
		defaultSortBy: "createdAt",
		defaultSortDirection: "desc",
		defaultLimit: 10,
	});
}
