"use client";

import type {
	OnChangeFn,
	SortingState,
	VisibilityState,
} from "@tanstack/react-table";
import {
	parseAsInteger,
	parseAsString,
	useQueryState,
	useQueryStates,
} from "nuqs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDebounceCallback } from "usehooks-ts";
import { getSortingStateParser } from "./parsers";
import type {
	BaseFilterState,
	FilterParsers,
	TablePaginationState,
	UseDataTableConfig,
	UseDataTableReturn,
	UseDataTableWithViewsConfig,
	UseDataTableWithViewsReturn,
	ViewState,
} from "./types";

const DEFAULT_CONFIG = {
	defaultLimit: 10,
	defaultSortDirection: "desc" as const,
	debounceMs: 300,
	clearOnDefault: true,
};

const COLUMN_VISIBILITY_STORAGE_PREFIX = "datatable-column-visibility";
const COLUMN_VISIBILITY_EVENT = "datatable-column-visibility-change";

function getColumnVisibilityStorageKey(key?: string) {
	return key ? `${COLUMN_VISIBILITY_STORAGE_PREFIX}:${key}` : null;
}

function readColumnVisibility(storageKey: string | null): VisibilityState {
	if (!storageKey || typeof window === "undefined") {
		return {};
	}

	try {
		const raw = window.localStorage.getItem(storageKey);
		if (!raw) {
			return {};
		}

		const parsed = JSON.parse(raw);
		return typeof parsed === "object" && parsed !== null ? parsed : {};
	} catch {
		return {};
	}
}

function useSharedColumnVisibility(columnVisibilityKey?: string) {
	const storageKey = useMemo(
		() => getColumnVisibilityStorageKey(columnVisibilityKey),
		[columnVisibilityKey],
	);
	const [columnVisibility, setColumnVisibilityState] =
		useState<VisibilityState>(() => readColumnVisibility(storageKey));

	const setSharedColumnVisibility = useCallback(
		(nextState: VisibilityState) => {
			setColumnVisibilityState(nextState);

			if (!storageKey || typeof window === "undefined") {
				return;
			}

			try {
				window.localStorage.setItem(
					storageKey,
					JSON.stringify(nextState),
				);
			} catch {
				// Ignore storage failures in restricted environments.
			}

			window.dispatchEvent(
				new CustomEvent(COLUMN_VISIBILITY_EVENT, {
					detail: {
						storageKey,
						columnVisibility: nextState,
					},
				}),
			);
		},
		[storageKey],
	);

	useEffect(() => {
		if (!storageKey || typeof window === "undefined") {
			return;
		}

		setColumnVisibilityState(readColumnVisibility(storageKey));

		const handleStorage = (event: StorageEvent) => {
			if (event.key !== storageKey) {
				return;
			}
			setColumnVisibilityState(readColumnVisibility(storageKey));
		};

		const handleColumnVisibilityEvent = (event: Event) => {
			const customEvent = event as CustomEvent<{
				storageKey?: string;
				columnVisibility?: VisibilityState;
			}>;

			if (customEvent.detail?.storageKey !== storageKey) {
				return;
			}

			setColumnVisibilityState(customEvent.detail.columnVisibility ?? {});
		};

		window.addEventListener("storage", handleStorage);
		window.addEventListener(
			COLUMN_VISIBILITY_EVENT,
			handleColumnVisibilityEvent as EventListener,
		);

		return () => {
			window.removeEventListener("storage", handleStorage);
			window.removeEventListener(
				COLUMN_VISIBILITY_EVENT,
				handleColumnVisibilityEvent as EventListener,
			);
		};
	}, [storageKey]);

	return [columnVisibility, setSharedColumnVisibility] as const;
}

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
	const [columnVisibility, setColumnVisibilityState] =
		useSharedColumnVisibility(mergedConfig.columnVisibilityKey);

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
		const resetValues: Record<string, null> = { search: null };
		if (filterParsers) {
			for (const key of Object.keys(filterParsers)) {
				resetValues[key] = null;
			}
		}
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

	// Handler for DataTablePagination limit change
	const onLimitChange = useCallback(
		(limit: number) => {
			setLimit(limit);
		},
		[setLimit],
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

	const setColumnVisibility = useCallback(
		(visibility: VisibilityState) => {
			setColumnVisibilityState(visibility);
		},
		[setColumnVisibilityState],
	);

	const onColumnVisibilityChange: OnChangeFn<VisibilityState> = useCallback(
		(updater) => {
			const newState =
				typeof updater === "function"
					? updater(columnVisibility)
					: updater;
			setColumnVisibilityState(newState);
		},
		[columnVisibility, setColumnVisibilityState],
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
		filters: filterState as TFilters,
		pagination: {
			page: paginationState.page,
			limit: paginationState.limit,
		},
		sorting,
		setFilter,
		setFilters,
		setPage,
		setLimit,
		setSorting,
		resetFilters,
		isFiltered,
		activeFilterCount,
		onPaginationChange,
		onLimitChange,
		onSortingChange,
		sortingState,
		columnVisibility,
		setColumnVisibility,
		onColumnVisibilityChange,
	};
}

export function useDataTableWithViews<
	TFilters extends BaseFilterState = BaseFilterState,
>(
	filterParsers?: FilterParsers<TFilters>,
	config?: UseDataTableWithViewsConfig<TFilters>,
): UseDataTableWithViewsReturn<TFilters> {
	const mergedConfig = { ...DEFAULT_CONFIG, ...config };
	const [columnVisibility, setColumnVisibilityState] =
		useSharedColumnVisibility(
			mergedConfig.columnVisibilityKey ?? mergedConfig.entityType,
		);

	// Default sorting state for TanStack Table
	const defaultSortingState: SortingState = mergedConfig.defaultSortBy
		? [
				{
					id: mergedConfig.defaultSortBy,
					desc: mergedConfig.defaultSortDirection === "desc",
				},
			]
		: [];

	// Combined state for atomic view updates (viewId + filters + sorting)
	// This prevents multiple URL updates when switching views
	const [combinedState, setCombinedState] = useQueryStates(
		{
			viewId: parseAsString,
			search: parseAsString,
			sort: getSortingStateParser().withDefault(defaultSortingState),
			...filterParsers,
		} as Parameters<typeof useQueryStates>[0],
		{
			clearOnDefault: mergedConfig.clearOnDefault,
			shallow: false,
			throttleMs: 50,
		},
	);

	// Pagination state (separate, not affected by view changes)
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

	// Debounced filter setter - for individual filter changes
	const debouncedSetFilters = useDebounceCallback(
		(updates: Partial<TFilters>) => {
			void setCombinedState(updates as Record<string, string | null>);
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
	const setSorting = useCallback(
		(sortBy: string | null, sortDirection: "asc" | "desc") => {
			if (sortBy) {
				void setCombinedState({
					sort: [{ id: sortBy, desc: sortDirection === "desc" }],
				} as Record<string, unknown>);
			} else {
				void setCombinedState({
					sort: defaultSortingState,
				} as Record<string, unknown>);
			}
		},
		[setCombinedState, defaultSortingState],
	);

	// Reset all filters to defaults
	const resetFilters = useCallback(() => {
		const resetValues: Record<string, null> = {
			search: null,
			viewId: null,
		};
		if (filterParsers) {
			for (const key of Object.keys(filterParsers)) {
				resetValues[key] = null;
			}
		}
		void setCombinedState(resetValues);
		void setPaginationState((prev) => ({ ...prev, page: 1 }));
	}, [setCombinedState, setPaginationState, filterParsers]);

	// Handler for DataTablePagination component
	const onPaginationChange = useCallback(
		(pagination: TablePaginationState) => {
			setPage(pagination.page);
		},
		[setPage],
	);

	// Handler for DataTablePagination limit change
	const onLimitChange = useCallback(
		(limit: number) => {
			setLimit(limit);
		},
		[setLimit],
	);

	// Extract sorting state from combined state
	const sortingState =
		(combinedState.sort as SortingState) ?? defaultSortingState;

	// Handler for TanStack Table sorting - directly updates URL state
	const onSortingChange: OnChangeFn<SortingState> = useCallback(
		(updater) => {
			const newState =
				typeof updater === "function" ? updater(sortingState) : updater;
			void setCombinedState({ sort: newState } as Record<
				string,
				unknown
			>);
		},
		[sortingState, setCombinedState],
	);

	// Derived: current sort column and direction (for API calls)
	const sorting = useMemo(() => {
		const firstSort = sortingState[0];
		return {
			sortBy: firstSort?.id ?? null,
			sortDirection: (firstSort?.desc ? "desc" : "asc") as "asc" | "desc",
		};
	}, [sortingState]);

	// Extract filter state from combined state (exclude viewId and sort)
	const filterState = useMemo(() => {
		const { viewId: _viewId, sort: _sort, ...filters } = combinedState;
		return filters as TFilters;
	}, [combinedState]);

	// Derived: is any filter active?
	const isFiltered = useMemo(() => {
		return Object.values(filterState).some((v) => v != null && v !== "");
	}, [filterState]);

	// Derived: count of active filters
	const activeFilterCount = useMemo(() => {
		return Object.values(filterState).filter((v) => v != null && v !== "")
			.length;
	}, [filterState]);

	// Apply a view atomically - single URL update
	const applyView = useCallback(
		(view: {
			id: string;
			filters: Record<string, unknown>;
			sorting: Array<{ id: string; desc: boolean }> | null;
			columnVisibility: Record<string, boolean> | null;
		}) => {
			// Build the complete state update
			const updates: Record<string, unknown> = {
				viewId: view.id,
			};

			// Add filter values
			const filterKeys = filterParsers ? Object.keys(filterParsers) : [];
			for (const key of filterKeys) {
				updates[key] = view.filters[key] ?? null;
			}
			if ("search" in view.filters) {
				updates.search = view.filters.search;
			} else {
				updates.search = null;
			}

			// Add sorting
			if (view.sorting && view.sorting.length > 0) {
				updates.sort = view.sorting;
			} else {
				updates.sort = defaultSortingState;
			}

			// Single atomic update - no multiple navigations
			void setCombinedState(updates);

			// Reset page to 1 when switching views
			void setPaginationState((prev) => ({ ...prev, page: 1 }));

			// Column visibility is local state, not URL
			if (view.columnVisibility) {
				setColumnVisibilityState(view.columnVisibility);
			}
		},
		[
			setCombinedState,
			setPaginationState,
			filterParsers,
			defaultSortingState,
		],
	);

	const clearView = useCallback(() => {
		const resetValues: Record<string, null> = {
			viewId: null,
			search: null,
		};
		if (filterParsers) {
			for (const key of Object.keys(filterParsers)) {
				resetValues[key] = null;
			}
		}
		void setCombinedState(resetValues);
		void setPaginationState((prev) => ({ ...prev, page: 1 }));
		setColumnVisibilityState({});
	}, [setCombinedState, setPaginationState, filterParsers]);

	const getCurrentViewState = useCallback((): ViewState<TFilters> => {
		return {
			filters: filterState,
			sorting: sortingState,
			columnVisibility,
		};
	}, [filterState, sortingState, columnVisibility]);

	const setColumnVisibility = useCallback((visibility: VisibilityState) => {
		setColumnVisibilityState(visibility);
	}, []);

	const onColumnVisibilityChange: OnChangeFn<VisibilityState> = useCallback(
		(updater) => {
			const newState =
				typeof updater === "function"
					? updater(columnVisibility)
					: updater;
			setColumnVisibilityState(newState);
		},
		[columnVisibility],
	);

	return {
		filters: filterState,
		pagination: {
			page: paginationState.page,
			limit: paginationState.limit,
		},
		sorting,
		setFilter,
		setFilters,
		setPage,
		setLimit,
		setSorting,
		resetFilters,
		isFiltered,
		activeFilterCount,
		onPaginationChange,
		onLimitChange,
		onSortingChange,
		sortingState,
		activeViewId: combinedState.viewId as string | null,
		applyView,
		clearView,
		getCurrentViewState,
		columnVisibility,
		setColumnVisibility,
		onColumnVisibilityChange,
	};
}
