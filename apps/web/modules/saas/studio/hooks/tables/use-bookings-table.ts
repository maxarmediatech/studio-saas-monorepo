"use client";

import type { BookingPhase } from "@repo/api/modules/studio/schemas/common";
import { parseAsArrayOf, parseAsString, parseAsStringLiteral } from "nuqs";
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
	bookingType?: string[] | null;
	packageType?: string[] | null;
	bookingDate?: string[] | null; // Array of [from, to] dates in YYYY-MM-DD format
	createdAt?: string[] | null; // Backwards-compatible alias for older saved views
}

/**
 * nuqs parsers for booking-specific filters
 * Using comma separators for array values to match our existing URL filter shape
 */
const bookingFilterParsers = {
	statuses: parseAsArrayOf(parseAsStringLiteral(BOOKING_PHASES)),
	bookingType: parseAsArrayOf(parseAsString, ","),
	packageType: parseAsArrayOf(parseAsString, ","),
	bookingDate: parseAsArrayOf(parseAsString, ","),
	createdAt: parseAsArrayOf(parseAsString, ","),
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
 *   sortBy: sorting.sortBy ?? "bookingDate",
 *   sortDirection: sorting.sortDirection,
 * }));
 * ```
 */
export function useBookingsTable() {
	return useDataTable<BookingFilters>(bookingFilterParsers, {
		columnVisibilityKey: "booking",
		defaultSortBy: "bookingDate",
		defaultSortDirection: "desc",
		defaultLimit: 10,
	});
}
