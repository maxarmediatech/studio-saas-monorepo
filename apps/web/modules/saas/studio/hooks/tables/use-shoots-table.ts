"use client";

import { parseAsArrayOf, parseAsString } from "nuqs";
import { useDataTable } from "@/modules/saas/shared/hooks/use-data-table";

/**
 * Shoot types matching SHOOT_TYPE_OPTIONS from booking-form-schema.ts
 */
export const SHOOT_TYPES = [
	"pre_wedding",
	"wedding",
	"reception",
	"engagement",
	"mehendi",
	"sangeet",
	"haldi",
	"portrait",
	"maternity",
	"baby_shoot",
	"other",
] as const;

/**
 * Shoot type options for filter display
 */
export const SHOOT_TYPE_OPTIONS = SHOOT_TYPES.map((type) => ({
	value: type,
	label: type
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" "),
}));

/**
 * Filter state for shoots table
 */
export interface ShootFilters {
	search?: string | null;
	bookingId?: string | null;
	shootType?: string[] | null;
	status?: string[] | null;
	shootDate?: string[] | null; // Array of [from, to] dates in YYYY-MM-DD format
}

/**
 * nuqs parsers for shoot-specific filters
 * Using comma separator for array values to match existing pattern
 */
const shootFilterParsers = {
	bookingId: parseAsString,
	shootType: parseAsArrayOf(parseAsString, ","),
	status: parseAsArrayOf(parseAsString, ","),
	shootDate: parseAsArrayOf(parseAsString, ","),
};

/**
 * Hook for managing shoots table state with URL synchronization.
 *
 * @example
 * ```tsx
 * const {
 *   filters,
 *   pagination,
 *   sorting,
 *   setFilter,
 *   onPaginationChange,
 * } = useShootsTable();
 *
 * // Use in query
 * const { data } = useQuery(shootsApi.listOptions({
 *   page: pagination.page,
 *   limit: pagination.limit,
 *   search: filters.search ?? undefined,
 *   shootType: filters.shootType?.join(",") ?? undefined,
 *   status: filters.status?.join(",") ?? undefined,
 *   sortBy: sorting.sortBy ?? "shootDate",
 *   sortDirection: sorting.sortDirection,
 * }));
 * ```
 */
export function useShootsTable() {
	return useDataTable<ShootFilters>(shootFilterParsers, {
		columnVisibilityKey: "shoot",
		defaultSortBy: "shootDate",
		defaultSortDirection: "desc",
		defaultLimit: 10,
	});
}
