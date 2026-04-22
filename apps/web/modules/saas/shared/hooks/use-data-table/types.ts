import type { SavedViewEntityType } from "@saas/shared/components/views/types";
import type {
	OnChangeFn,
	SortingState,
	VisibilityState,
} from "@tanstack/react-table";

/**
 * Pagination state compatible with existing DataTablePagination component
 */
export interface TablePaginationState {
	page: number;
	limit: number;
	total: number;
	pageCount: number;
}

/**
 * URL-synced pagination state (subset of TablePaginationState)
 * Total and pageCount come from server response, not URL
 */
export interface UrlPaginationState {
	page: number;
	limit: number;
}

/**
 * Sorting state for URL sync
 */
export interface TableSortingState {
	sortBy: string | null;
	sortDirection: "asc" | "desc";
}

/**
 * Base filter state - all entity filters extend this
 */
export interface BaseFilterState {
	search?: string | null;
}

/**
 * Configuration options for useDataTable hook
 */
export interface UseDataTableConfig<TFilters extends BaseFilterState> {
	/** Default pagination limit (default: 10) */
	defaultLimit?: number;
	/** Default sort column */
	defaultSortBy?: string;
	/** Default sort direction (default: "desc") */
	defaultSortDirection?: "asc" | "desc";
	/** Debounce delay for filter updates in ms (default: 300) */
	debounceMs?: number;
	/** Clear URL params when they match default values (default: true) */
	clearOnDefault?: boolean;
	/** Initial filter values */
	initialFilters?: Partial<TFilters>;
	/** Shared column visibility storage key */
	columnVisibilityKey?: string;
}

/**
 * Return value from useDataTable hook
 */
export interface UseDataTableReturn<TFilters extends BaseFilterState> {
	// === URL State ===
	/** Current filter values */
	filters: TFilters;
	/** Current pagination state (page and limit from URL) */
	pagination: UrlPaginationState;
	/** Current sorting state */
	sorting: TableSortingState;

	// === Setters (debounced for filters) ===
	/** Set a single filter value (debounced, resets page to 1) */
	setFilter: <K extends keyof TFilters>(key: K, value: TFilters[K]) => void;
	/** Set multiple filter values at once (debounced, resets page to 1) */
	setFilters: (filters: Partial<TFilters>) => void;
	/** Set current page (immediate, not debounced) */
	setPage: (page: number) => void;
	/** Set page limit (immediate, not debounced) */
	setLimit: (limit: number) => void;
	/** Set sorting (immediate, not debounced) */
	setSorting: (sortBy: string | null, sortDirection: "asc" | "desc") => void;
	/** Reset all filters to initial/default values */
	resetFilters: () => void;

	// === Derived State ===
	/** True if any filter is active */
	isFiltered: boolean;
	/** Count of active filters */
	activeFilterCount: number;

	// === TanStack Table Integration ===
	/** Handler for DataTablePagination component */
	onPaginationChange: (pagination: TablePaginationState) => void;
	/** Handler for DataTablePagination limit change */
	onLimitChange: (limit: number) => void;
	/** Handler for TanStack Table sorting */
	onSortingChange: OnChangeFn<SortingState>;
	/** TanStack Table compatible sorting state */
	sortingState: SortingState;
	/** Current column visibility state */
	columnVisibility: VisibilityState;
	/** Set column visibility */
	setColumnVisibility: (visibility: VisibilityState) => void;
	/** Handler for TanStack Table column visibility */
	onColumnVisibilityChange: OnChangeFn<VisibilityState>;
}

/**
 * Filter parser definition for entity-specific filters
 * Maps filter keys to nuqs parser instances
 */
export type FilterParsers<TFilters extends BaseFilterState> = {
	[K in keyof Omit<TFilters, "search">]?: unknown;
};

// ============================================================================
// Saved Views Integration Types
// ============================================================================

/**
 * State that can be saved to a view
 */
export interface ViewState<TFilters extends BaseFilterState> {
	filters: Partial<TFilters>;
	sorting: SortingState;
	columnVisibility?: VisibilityState;
}

/**
 * Extended configuration for useDataTable with saved views support
 */
export interface UseDataTableWithViewsConfig<TFilters extends BaseFilterState>
	extends UseDataTableConfig<TFilters> {
	/** Entity type for saved views (enables view features when provided) */
	entityType?: SavedViewEntityType;
}

/**
 * Extended return value with saved views support
 */
export interface UseDataTableWithViewsReturn<TFilters extends BaseFilterState>
	extends UseDataTableReturn<TFilters> {
	// === View State ===
	/** Current active view ID (from URL) */
	activeViewId: string | null;

	// === View Actions ===
	/** Apply a saved view's state to the table */
	applyView: (view: {
		id: string;
		filters: Record<string, unknown>;
		sorting: Array<{ id: string; desc: boolean }> | null;
		columnVisibility: Record<string, boolean> | null;
	}) => void;
	/** Clear active view and reset to defaults */
	clearView: () => void;
	/** Get current table state for saving as a view */
	getCurrentViewState: () => ViewState<TFilters>;
}
