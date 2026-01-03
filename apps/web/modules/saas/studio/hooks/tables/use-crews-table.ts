"use client";

import { parseAsArrayOf, parseAsString } from "nuqs";
import { useDataTable } from "@/modules/saas/shared/hooks/use-data-table";

/**
 * Filter state for crews table
 */
export interface CrewFilters {
	search?: string | null;
	status?: string[] | null;
	role?: string[] | null;
}

/**
 * nuqs parsers for crew-specific filters
 * Using comma separator for array values
 */
const crewFilterParsers = {
	status: parseAsArrayOf(parseAsString, ","),
	role: parseAsArrayOf(parseAsString, ","),
};

/**
 * Hook for managing crews table state with URL synchronization.
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
 * } = useCrewsTable();
 *
 * // Use in query
 * const { data } = useQuery(crewsApi.listOptions({
 *   page: pagination.page,
 *   limit: pagination.limit,
 *   search: filters.search ?? undefined,
 *   status: filters.status?.join(",") ?? undefined,
 *   sortBy: sorting.sortBy ?? "name",
 *   sortDirection: sorting.sortDirection,
 * }));
 * ```
 */
export function useCrewsTable() {
	return useDataTable<CrewFilters>(crewFilterParsers, {
		defaultSortBy: "name",
		defaultSortDirection: "asc",
		defaultLimit: 10,
	});
}
