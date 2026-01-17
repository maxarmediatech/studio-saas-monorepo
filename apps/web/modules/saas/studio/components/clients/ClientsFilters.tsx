"use client";

import type { ToolbarFilterConfig } from "@saas/shared/components/data-table";
import { DataTableToolbarWithViews } from "@saas/shared/components/data-table";
import type { SavedView } from "@saas/shared/components/views";
import { useClientsTableWithViews } from "@saas/studio/hooks/tables";
import { useCallback } from "react";

export function ClientsFilters() {
	const {
		filters,
		setFilter,
		resetFilters,
		isFiltered,
		activeViewId,
		applyView,
		sortingState,
		columnVisibility,
	} = useClientsTableWithViews();

	const filterConfigs: ToolbarFilterConfig[] = [];

	const handleSearchChange = useCallback(
		(value: string) => {
			setFilter("search", value || null);
		},
		[setFilter],
	);

	const handleViewSelect = useCallback(
		(view: SavedView) => {
			applyView(view);
		},
		[applyView],
	);

	const getCurrentFilters = useCallback(() => {
		return filters as Record<string, unknown>;
	}, [filters]);

	const getCurrentSorting = useCallback(() => {
		return sortingState;
	}, [sortingState]);

	const getCurrentColumnVisibility = useCallback(() => {
		return columnVisibility;
	}, [columnVisibility]);

	return (
		<DataTableToolbarWithViews
			entityType="client"
			activeViewId={activeViewId}
			onViewSelect={handleViewSelect}
			getCurrentFilters={getCurrentFilters}
			getCurrentSorting={getCurrentSorting}
			getCurrentColumnVisibility={getCurrentColumnVisibility}
			filters={filterConfigs}
			filterValues={{}}
			onFilterChange={() => {}}
			onResetFilters={resetFilters}
			isFiltered={isFiltered}
			showSearch
			searchValue={filters.search ?? ""}
			searchPlaceholder="Search clients..."
			onSearchChange={handleSearchChange}
			showViewOptions={false}
		/>
	);
}
