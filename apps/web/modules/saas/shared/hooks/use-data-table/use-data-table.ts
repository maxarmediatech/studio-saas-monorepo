"use client";

import { useCallback, useMemo } from "react";
import { useQueryStates, parseAsInteger, parseAsString } from "nuqs";
import { useDebounceCallback } from "usehooks-ts";
import type { OnChangeFn, SortingState } from "@tanstack/react-table";
import type {
	BaseFilterState,
	FilterParsers,
	TablePaginationState,
	UseDataTableConfig,
	UseDataTableReturn,
} from "./types";

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
 * - Debounced filter updates (300ms default)
 * - TanStack Table compatible sorting state
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
	config?: UseDataTableConfig<TFilters>
): UseDataTableReturn<TFilters> {
	const mergedConfig = { ...DEFAULT_CONFIG, ...config };

	// Core state: pagination and sorting
	const [coreState, setCoreState] = useQueryStates(
		{
			page: parseAsInteger.withDefault(1),
			limit: parseAsInteger.withDefault(mergedConfig.defaultLimit),
			sortBy: mergedConfig.defaultSortBy
				? parseAsString.withDefault(mergedConfig.defaultSortBy)
				: parseAsString,
			sortDirection: parseAsString.withDefault(
				mergedConfig.defaultSortDirection
			),
		},
		{
			clearOnDefault: mergedConfig.clearOnDefault,
			shallow: false,
		}
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
		}
	);

	// Debounced filter setter - resets page to 1
	const debouncedSetFilters = useDebounceCallback(
		(updates: Partial<TFilters>) => {
			void setFilterState(updates as Record<string, string | null>);
			void setCoreState((prev) => ({ ...prev, page: 1 }));
		},
		mergedConfig.debounceMs
	);

	// Set a single filter value
	const setFilter = useCallback(
		<K extends keyof TFilters>(key: K, value: TFilters[K]) => {
			debouncedSetFilters({ [key]: value } as unknown as Partial<TFilters>);
		},
		[debouncedSetFilters]
	);

	// Set multiple filter values
	const setFilters = useCallback(
		(filters: Partial<TFilters>) => {
			debouncedSetFilters(filters);
		},
		[debouncedSetFilters]
	);

	// Set page (immediate, not debounced)
	const setPage = useCallback(
		(page: number) => {
			void setCoreState((prev) => ({ ...prev, page }));
		},
		[setCoreState]
	);

	// Set limit (immediate, not debounced)
	const setLimit = useCallback(
		(limit: number) => {
			void setCoreState((prev) => ({ ...prev, limit, page: 1 }));
		},
		[setCoreState]
	);

	// Set sorting (immediate, not debounced)
	const setSorting = useCallback(
		(sortBy: string | null, sortDirection: "asc" | "desc") => {
			void setCoreState((prev) => ({
				...prev,
				sortBy: sortBy ?? null,
				sortDirection,
			}));
		},
		[setCoreState]
	);

	// Reset all filters to defaults
	const resetFilters = useCallback(() => {
		const resetValues = Object.keys({ search: null, ...filterParsers }).reduce(
			(acc, key) => ({ ...acc, [key]: null }),
			{}
		);
		void setFilterState(resetValues);
		void setCoreState((prev) => ({ ...prev, page: 1 }));
	}, [setFilterState, setCoreState, filterParsers]);

	// Handler for DataTablePagination component
	const onPaginationChange = useCallback(
		(pagination: TablePaginationState) => {
			setPage(pagination.page);
		},
		[setPage]
	);

	// Handler for TanStack Table sorting
	const onSortingChange: OnChangeFn<SortingState> = useCallback(
		(updater) => {
			const current = coreState.sortBy
				? [
						{
							id: coreState.sortBy,
							desc: coreState.sortDirection === "desc",
						},
					]
				: [];
			const newState =
				typeof updater === "function" ? updater(current) : updater;

			if (newState.length > 0) {
				setSorting(newState[0].id, newState[0].desc ? "desc" : "asc");
			} else {
				setSorting(null, mergedConfig.defaultSortDirection);
			}
		},
		[
			coreState.sortBy,
			coreState.sortDirection,
			setSorting,
			mergedConfig.defaultSortDirection,
		]
	);

	// TanStack Table compatible sorting state
	const sortingState: SortingState = useMemo(() => {
		if (!coreState.sortBy) return [];
		return [
			{ id: coreState.sortBy, desc: coreState.sortDirection === "desc" },
		];
	}, [coreState.sortBy, coreState.sortDirection]);

	// Derived: is any filter active?
	const isFiltered = useMemo(() => {
		return Object.values(filterState).some(
			(v) => v != null && v !== ""
		);
	}, [filterState]);

	// Derived: count of active filters
	const activeFilterCount = useMemo(() => {
		return Object.values(filterState).filter(
			(v) => v != null && v !== ""
		).length;
	}, [filterState]);

	return {
		// State
		filters: filterState as TFilters,
		pagination: {
			page: coreState.page,
			limit: coreState.limit,
		},
		sorting: {
			sortBy: coreState.sortBy ?? null,
			sortDirection: (coreState.sortDirection as "asc" | "desc") ?? "desc",
		},

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
		sortingState,
	};
}
