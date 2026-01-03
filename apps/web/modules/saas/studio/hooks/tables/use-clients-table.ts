"use client";

import { useDataTable } from "@/modules/saas/shared/hooks/use-data-table";

/**
 * Filter state for clients table
 * Clients don't have specific filter facets, just search and sorting
 */
export interface ClientFilters {
	search?: string | null;
}

/**
 * nuqs parsers for client-specific filters
 * Currently empty since clients only use search (handled by base parsers)
 */
const clientFilterParsers = {};

/**
 * Hook for managing clients table state with URL synchronization.
 *
 * @example
 * ```tsx
 * const {
 *   filters,
 *   pagination,
 *   sorting,
 *   setFilter,
 *   onPaginationChange,
 * } = useClientsTable();
 *
 * // Use in query
 * const { data } = useQuery(clientsApi.listOptions({
 *   page: pagination.page,
 *   limit: pagination.limit,
 *   search: filters.search ?? undefined,
 *   sortBy: sorting.sortBy ?? "name",
 *   sortDirection: sorting.sortDirection,
 * }));
 * ```
 */
export function useClientsTable() {
	return useDataTable<ClientFilters>(clientFilterParsers, {
		defaultSortBy: "name",
		defaultSortDirection: "asc",
		defaultLimit: 10,
	});
}
