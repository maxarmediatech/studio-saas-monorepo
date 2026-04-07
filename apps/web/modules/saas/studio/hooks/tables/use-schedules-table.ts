"use client";

import { parseAsArrayOf, parseAsString } from "nuqs";
import { useDataTable } from "@/modules/saas/shared/hooks/use-data-table";

/**
 * Schedule status options for filter
 * Matches scheduleStatusSchema in packages/api/modules/studio/schemas/common.ts
 */
const SCHEDULE_STATUSES = [
	"pending",
	"partial",
	"completed",
	"overdue",
	"cancelled",
] as const;

/**
 * Filter state for schedules table
 */
export interface ScheduleFilters {
	search?: string | null;
	status?: string[] | null;
}

/**
 * nuqs parsers for schedule-specific filters
 * Using comma separator for array values
 */
const scheduleFilterParsers = {
	status: parseAsArrayOf(parseAsString, ","),
};

/**
 * Hook for managing schedules table state with URL synchronization.
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
 * } = useSchedulesTable();
 *
 * // Use in query
 * const { data } = useQuery(studioPaymentsApi.listSchedulesOptions({
 *   page: pagination.page,
 *   limit: pagination.limit,
 *   search: filters.search ?? undefined,
 *   status: filters.status ?? undefined,
 *   sortBy: sorting.sortBy ?? "dueDate",
 *   sortDirection: sorting.sortDirection,
 * }));
 * ```
 */
export function useSchedulesTable() {
	return useDataTable<ScheduleFilters>(scheduleFilterParsers, {
		columnVisibilityKey: "schedule",
		defaultSortBy: "dueDate",
		defaultSortDirection: "asc",
		defaultLimit: 10,
	});
}

export { SCHEDULE_STATUSES };
