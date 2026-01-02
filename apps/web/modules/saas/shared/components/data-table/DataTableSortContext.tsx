"use client";

import { createContext, useContext, type ReactNode } from "react";

interface SortContextValue {
	/** Current sort column ID, or null if not sorted */
	sortColumn: string | null;
	/** Current sort direction */
	sortDirection: "asc" | "desc";
}

const SortContext = createContext<SortContextValue | null>(null);

interface SortProviderProps {
	children: ReactNode;
	sortColumn: string | null;
	sortDirection: "asc" | "desc";
}

/**
 * Provider for sort state context.
 * Wrap your DataTable with this to enable direct URL state reading in column headers.
 *
 * @example
 * ```tsx
 * const { sorting } = useDataTable();
 *
 * <SortProvider
 *   sortColumn={sorting.sortBy}
 *   sortDirection={sorting.sortDirection}
 * >
 *   <DataTable ... />
 * </SortProvider>
 * ```
 */
export function SortProvider({
	children,
	sortColumn,
	sortDirection,
}: SortProviderProps) {
	return (
		<SortContext.Provider value={{ sortColumn, sortDirection }}>
			{children}
		</SortContext.Provider>
	);
}

/**
 * Hook to access sort state from context.
 * Returns null if not within a SortProvider.
 */
export function useSortContext(): SortContextValue | null {
	return useContext(SortContext);
}
