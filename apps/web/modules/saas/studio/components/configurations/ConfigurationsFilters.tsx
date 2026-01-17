"use client";

import {
	DataTableToolbar,
	type ToolbarFilterConfig,
} from "@saas/shared/components/data-table";
import { useConfigurationsTable } from "@saas/studio/hooks/tables";

interface ConfigurationsFiltersProps {
	/** Plural label for search placeholder (e.g., "Booking Types") */
	configTypeLabelPlural: string;
}

export function ConfigurationsFilters({
	configTypeLabelPlural,
}: ConfigurationsFiltersProps) {
	// Use the configurations table hook for URL-synced state
	const { filters, setFilter, resetFilters, isFiltered } =
		useConfigurationsTable();

	// No additional filters for configurations table (only search)
	const filterConfigs: ToolbarFilterConfig[] = [];

	// Handle search changes
	const handleSearchChange = (value: string) => {
		setFilter("search", value || null);
	};

	return (
		<DataTableToolbar
			filters={filterConfigs}
			filterValues={{}}
			onFilterChange={() => {}}
			onResetFilters={resetFilters}
			isFiltered={isFiltered}
			showSearch
			searchValue={filters.search ?? ""}
			searchPlaceholder={`Search ${configTypeLabelPlural.toLowerCase()}...`}
			onSearchChange={handleSearchChange}
			showViewOptions={false}
		/>
	);
}
