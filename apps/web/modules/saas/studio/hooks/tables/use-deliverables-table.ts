"use client";

import { parseAsArrayOf, parseAsString } from "nuqs";
import { useDataTable } from "@/modules/saas/shared/hooks/use-data-table";

/**
 * Deliverable types for filter options
 */
const DELIVERABLE_TYPES = [
	"wedding_album",
	"pre_wedding_album",
	"photo_album",
	"highlight_video",
	"full_video",
	"teaser",
	"reel",
	"edited_photos",
	"raw_photos",
	"raw_videos",
	"drone_footage",
	"frame",
	"canvas",
	"other",
] as const;

/**
 * Deliverable statuses for filter options
 */
const DELIVERABLE_STATUSES = [
	"pending",
	"in_progress",
	"completed",
	"delivered",
] as const;

/**
 * Deliverable priorities for filter options
 */
const DELIVERABLE_PRIORITIES = ["low", "medium", "high"] as const;

/**
 * Filter state for deliverables table
 */
export interface DeliverableFilters {
	search?: string | null;
	deliverableType?: string[] | null;
	status?: string[] | null;
	priority?: string[] | null;
}

/**
 * nuqs parsers for deliverable-specific filters
 * Using comma separator for array values
 */
const deliverableFilterParsers = {
	deliverableType: parseAsArrayOf(parseAsString, ","),
	status: parseAsArrayOf(parseAsString, ","),
	priority: parseAsArrayOf(parseAsString, ","),
};

/**
 * Hook for managing deliverables table state with URL synchronization.
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
 * } = useDeliverablesTable();
 *
 * // Use in query
 * const { data } = useQuery(deliverablesApi.listOptions({
 *   page: pagination.page,
 *   limit: pagination.limit,
 *   search: filters.search ?? undefined,
 *   deliverableType: filters.deliverableType?.[0] ?? undefined,
 *   status: filters.status?.[0] ?? undefined,
 *   priority: filters.priority?.[0] ?? undefined,
 *   sortBy: sorting.sortBy ?? "dueDate",
 *   sortDirection: sorting.sortDirection,
 * }));
 * ```
 */
export function useDeliverablesTable() {
	return useDataTable<DeliverableFilters>(deliverableFilterParsers, {
		defaultSortBy: "dueDate",
		defaultSortDirection: "asc",
		defaultLimit: 10,
	});
}

export { DELIVERABLE_PRIORITIES, DELIVERABLE_STATUSES, DELIVERABLE_TYPES };
