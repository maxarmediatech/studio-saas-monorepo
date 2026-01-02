"use client";

import { useCallback, useMemo } from "react";
import {
	useQueryStates,
	useQueryState,
	parseAsInteger,
	parseAsString,
} from "nuqs";
import { useDebounceCallback } from "usehooks-ts";
import type { OnChangeFn, SortingState } from "@tanstack/react-table";
import type {
	BaseFilterState,
	FilterParsers,
	TablePaginationState,
	UseDataTableConfig,
	UseDataTableReturn,
} from "./types";
import { getSortingStateParser } from "./parsers";

const DEFAULT_CONFIG = {
	defaultLimit: 10,
	defaultSortDirection: "desc" as const,
	debounceMs: 300,
	clearOnDefault: true,
};

/**
 * A reusable hook for managing data table state with URL synchronization.
 *
 * Features:
 * - URL-synced pagination, sorting, and filtering via nuqs
 * - JSON-based sorting state for proper TanStack Table integration
 * - Debounced filter updates (300ms default)
 * - Type-safe generics for entity-specific filters
 *
 * @example
 * ```tsx
 * // Basic usage with search only
 * const { filters, pagination, sorting, setFilter } = useDataTable();
 *
 * // With entity-specific filters
 * const { filters, setFilter } = useDataTable<BookingFilters>(
 *   { status: parseAsStringLiteral(BOOKING_PHASES) },
 *   { defaultSortBy: "createdAt" }
 * );
 * ```
 */
export function useDataTable<
	TFilters extends BaseFilterState = BaseFilterState,
>(
	filterParsers?: FilterParsers<TFilters>,
	config?: UseDataTableConfig<TFilters>,
): UseDataTableReturn<TFilters> {
	const mergedConfig = { ...DEFAULT_CONFIG, ...config };

	// Default sorting state for TanStack Table
	const defaultSortingState: SortingState = mergedConfig.defaultSortBy
		? [
				{
					id: mergedConfig.defaultSortBy,
					desc: mergedConfig.defaultSortDirection === "desc",
				},
			]
		: [];

	// Pagination state
	const [paginationState, setPaginationState] = useQueryStates(
		{
			page: parseAsInteger.withDefault(1),
			limit: parseAsInteger.withDefault(mergedConfig.defaultLimit),
		},
		{
			clearOnDefault: mergedConfig.clearOnDefault,
			shallow: false,
		},
	);

	// Sorting state - JSON-based for direct TanStack Table compatibility
	// URL format: ?sort=[{"id":"createdAt","desc":true}]
	const [sortingState, setSortingState] = useQueryState(
		"sort",
		getSortingStateParser()
			.withOptions({
				clearOnDefault: mergedConfig.clearOnDefault,
				shallow: false,
			})
			.withDefault(defaultSortingState),
	);

	// Filter state: search + entity-specific filters
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const [filterState, setFilterState] = useQueryStates(
		{
			search: parseAsString,
			...filterParsers,
		} as any,
		{
			clearOnDefault: mergedConfig.clearOnDefault,
			shallow: false,
			throttleMs: 50,
		},
	);

	// Debounced filter setter - resets page to 1
	const debouncedSetFilters = useDebounceCallback(
		(updates: Partial<TFilters>) => {
			void setFilterState(updates as Record<string, string | null>);
			void setPaginationState((prev) => ({ ...prev, page: 1 }));
		},
		mergedConfig.debounceMs,
	);

	// Set a single filter value
	const setFilter = useCallback(
		<K extends keyof TFilters>(key: K, value: TFilters[K]) => {
			debouncedSetFilters({
				[key]: value,
			} as unknown as Partial<TFilters>);
		},
		[debouncedSetFilters],
	);

	// Set multiple filter values
	const setFilters = useCallback(
		(filters: Partial<TFilters>) => {
			debouncedSetFilters(filters);
		},
		[debouncedSetFilters],
	);

	// Set page (immediate, not debounced)
	const setPage = useCallback(
		(page: number) => {
			void setPaginationState((prev) => ({ ...prev, page }));
		},
		[setPaginationState],
	);

	// Set limit (immediate, not debounced)
	const setLimit = useCallback(
		(limit: number) => {
			void setPaginationState((prev) => ({ ...prev, limit, page: 1 }));
		},
		[setPaginationState],
	);

	// Set sorting (immediate, not debounced)
	// Accepts column ID and direction, converts to SortingState
	const setSorting = useCallback(
		(sortBy: string | null, sortDirection: "asc" | "desc") => {
			if (sortBy) {
				void setSortingState([
					{ id: sortBy, desc: sortDirection === "desc" },
				]);
			} else {
				void setSortingState(defaultSortingState);
			}
		},
		[setSortingState, defaultSortingState],
	);

	// Reset all filters to defaults
	const resetFilters = useCallback(() => {
		const resetValues = Object.keys({
			search: null,
			...filterParsers,
		}).reduce((acc, key) => ({ ...acc, [key]: null }), {});
		void setFilterState(resetValues);
		void setPaginationState((prev) => ({ ...prev, page: 1 }));
	}, [setFilterState, setPaginationState, filterParsers]);

	// Handler for DataTablePagination component
	const onPaginationChange = useCallback(
		(pagination: TablePaginationState) => {
			setPage(pagination.page);
		},
		[setPage],
	);

	// Handler for TanStack Table sorting - directly updates URL state
	const onSortingChange: OnChangeFn<SortingState> = useCallback(
		(updater) => {
			const newState =
				typeof updater === "function" ? updater(sortingState) : updater;
			void setSortingState(newState);
		},
		[sortingState, setSortingState],
	);

	// Derived: current sort column and direction (for API calls)
	const sorting = useMemo(() => {
		const firstSort = sortingState[0];
		return {
			sortBy: firstSort?.id ?? null,
			sortDirection: (firstSort?.desc ? "desc" : "asc") as "asc" | "desc",
		};
	}, [sortingState]);

	// Derived: is any filter active?
	const isFiltered = useMemo(() => {
		return Object.values(filterState).some((v) => v != null && v !== "");
	}, [filterState]);

	// Derived: count of active filters
	const activeFilterCount = useMemo(() => {
		return Object.values(filterState).filter((v) => v != null && v !== "")
			.length;
	}, [filterState]);

	return {
		// State
		filters: filterState as TFilters,
		pagination: {
			page: paginationState.page,
			limit: paginationState.limit,
		},
		sorting,

		// Setters
		setFilter,
		setFilters,
		setPage,
		setLimit,
		setSorting,
		resetFilters,

		// Derived
		isFiltered,
		activeFilterCount,

		// TanStack Table integration
		onPaginationChange,
		onSortingChange,
		sortingState, // Direct SortingState from URL - pass to useReactTable
	};
}
