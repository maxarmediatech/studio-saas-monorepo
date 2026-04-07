"use client";

import { parseAsArrayOf, parseAsString } from "nuqs";
import { useDataTable } from "@/modules/saas/shared/hooks/use-data-table";

/**
 * Task statuses for filter options
 */
const TASK_STATUSES = [
	"pending",
	"in_progress",
	"completed",
	"cancelled",
] as const;

/**
 * Task priorities for filter options
 */
const TASK_PRIORITIES = ["high", "medium", "normal", "low"] as const;

/**
 * Filter state for tasks table
 */
export interface TaskFilters {
	search?: string | null;
	status?: string[] | null;
	priority?: string[] | null;
}

/**
 * nuqs parsers for task-specific filters
 * Using comma separator for array values
 */
const taskFilterParsers = {
	status: parseAsArrayOf(parseAsString, ","),
	priority: parseAsArrayOf(parseAsString, ","),
};

/**
 * Hook for managing tasks table state with URL synchronization.
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
 * } = useTasksTable();
 *
 * // Use in query
 * const { data } = useQuery(tasksApi.listOptions({
 *   page: pagination.page,
 *   limit: pagination.limit,
 *   search: filters.search ?? undefined,
 *   status: filters.status?.join(",") ?? undefined,
 *   priority: filters.priority?.join(",") ?? undefined,
 *   sortBy: sorting.sortBy ?? "dueDate",
 *   sortDirection: sorting.sortDirection,
 * }));
 * ```
 */
export function useTasksTable() {
	return useDataTable<TaskFilters>(taskFilterParsers, {
		columnVisibilityKey: "task",
		defaultSortBy: "dueDate",
		defaultSortDirection: "asc",
		defaultLimit: 10,
	});
}

export { TASK_STATUSES, TASK_PRIORITIES };
