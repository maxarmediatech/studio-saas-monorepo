"use client";

import {
	DataTableExportButton,
	DataTableToolbar,
	type ToolbarFilterConfig,
} from "@saas/shared/components/data-table";
import type { ConfigType } from "@saas/studio/hooks/tables";
import { useConfigurationsTable } from "@saas/studio/hooks/tables";

interface ConfigurationsFiltersProps {
	configType: ConfigType;
	/** Plural label for search placeholder (e.g., "Booking Types") */
	configTypeLabelPlural: string;
}

export function ConfigurationsFilters({
	configType,
	configTypeLabelPlural,
}: ConfigurationsFiltersProps) {
	// Use the configurations table hook for URL-synced state
	const {
		filters,
		pagination,
		sorting,
		setFilter,
		resetFilters,
		isFiltered,
		columnVisibility,
	} = useConfigurationsTable();

	// No additional filters for configurations table (only search)
	const filterConfigs: ToolbarFilterConfig[] = [];

	// Handle search changes
	const handleSearchChange = (value: string) => {
		setFilter("search", value || null);
	};

	const queryInput = {
		type: configType,
		page: pagination.page,
		limit: pagination.limit,
		search: filters.search ?? undefined,
		sortBy: (sorting.sortBy ?? "sortOrder") as
			| "sortOrder"
			| "label"
			| "createdAt",
		sortDirection: sorting.sortDirection,
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
		>
			<DataTableExportButton
				entityType="configuration"
				input={queryInput}
				columnVisibility={columnVisibility}
				iconOnly
			/>
		</DataTableToolbar>
	);
}
