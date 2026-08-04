"use client";

import { useDataTable } from "@/modules/saas/shared/hooks/use-data-table";

/**
 * Configuration types supported by the configurations table
 */
export type ConfigType =
	| "booking_type"
	| "package_type"
	| "relation_type"
	| "crew_role"
	| "event_type"
	| "quotation_terms";

/**
 * Filter state for configurations table
 * Configurations only use search filter (type is determined by route)
 */
export interface ConfigurationFilters {
	search?: string | null;
}

/**
 * nuqs parsers for configuration-specific filters
 * Currently empty since configurations only use search (handled by base parsers)
 */
const configurationFilterParsers = {};

/**
 * Hook for managing configurations table state with URL synchronization.
 *
 * Note: configType is NOT a URL param - it's determined by the route path.
 * This hook manages pagination, sorting, and search filters.
 *
 * @example
 * ```tsx
 * const {
 *   filters,
 *   pagination,
 *   sorting,
 *   setFilter,
 *   onPaginationChange,
 * } = useConfigurationsTable();
 *
 * // Use in query
 * const { data } = useQuery(configurationsApi.listOptions({
 *   type: configType, // from props, not hook
 *   page: pagination.page,
 *   limit: pagination.limit,
 *   search: filters.search ?? undefined,
 *   sortBy: sorting.sortBy ?? "sortOrder",
 *   sortDirection: sorting.sortDirection,
 * }));
 * ```
 */
export function useConfigurationsTable() {
	return useDataTable<ConfigurationFilters>(configurationFilterParsers, {
		columnVisibilityKey: "configuration",
		defaultSortBy: "sortOrder",
		defaultSortDirection: "asc",
		defaultLimit: 50,
	});
}
