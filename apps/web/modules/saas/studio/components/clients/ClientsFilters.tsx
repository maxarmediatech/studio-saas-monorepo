"use client";

import {
	DataTableToolbar,
	type ToolbarFilterConfig,
} from "@saas/shared/components/data-table";
import { useClientsTable } from "@saas/studio/hooks/tables";

export function ClientsFilters() {
	// Use the clients table hook for URL-synced state
	const { filters, setFilter, resetFilters, isFiltered } = useClientsTable();

	// No additional filters for clients table (only search)
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
			searchPlaceholder="Search clients..."
			onSearchChange={handleSearchChange}
			showViewOptions={false}
		/>
	);
}
