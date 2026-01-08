"use client";

import {
	DataTableToolbar,
	type ToolbarFilterConfig,
} from "@saas/shared/components/data-table";
import { useCrewsTable } from "@saas/studio/hooks/tables";
import { BriefcaseIcon, UserIcon } from "lucide-react";
import { useMemo } from "react";

const statusOptions = [
	{ value: "active", label: "Active" },
	{ value: "inactive", label: "Inactive" },
	{ value: "unavailable", label: "Unavailable" },
];

const roleOptions = [
	{ value: "photographer", label: "Photographer" },
	{ value: "videographer", label: "Videographer" },
	{ value: "editor", label: "Editor" },
	{ value: "assistant", label: "Assistant" },
	{ value: "makeup_artist", label: "Makeup Artist" },
	{ value: "coordinator", label: "Coordinator" },
	{ value: "other", label: "Other" },
];

export function CrewsFilters() {
	// Use the crews table hook for URL-synced state
	const { filters, setFilter, resetFilters, isFiltered } = useCrewsTable();

	// Define filter configurations
	const filterConfigs: ToolbarFilterConfig[] = useMemo(
		() => [
			{
				id: "status",
				label: "Status",
				variant: "multiSelect",
				icon: UserIcon,
				options: statusOptions,
			},
			{
				id: "role",
				label: "Role",
				variant: "multiSelect",
				icon: BriefcaseIcon,
				options: roleOptions,
			},
		],
		[],
	);

	// Convert filters to toolbar format
	const filterValues = useMemo(
		() => ({
			status: filters.status ?? [],
			role: filters.role ?? [],
		}),
		[filters.status, filters.role],
	);

	// Handle filter changes
	const handleFilterChange = (
		filterId: string,
		value:
			| string
			| string[]
			| { from?: string; to?: string }
			| null
			| undefined,
	) => {
		if (filterId === "status") {
			const values = Array.isArray(value) && value.length > 0 ? value : null;
			setFilter("status", values);
		} else if (filterId === "role") {
			const values = Array.isArray(value) && value.length > 0 ? value : null;
			setFilter("role", values);
		}
	};

	// Handle search changes
	const handleSearchChange = (value: string) => {
		setFilter("search", value || null);
	};

	return (
		<DataTableToolbar
			filters={filterConfigs}
			filterValues={filterValues}
			onFilterChange={handleFilterChange}
			onResetFilters={resetFilters}
			isFiltered={isFiltered}
			showSearch
			searchValue={filters.search ?? ""}
			searchPlaceholder="Search crew members..."
			onSearchChange={handleSearchChange}
			showViewOptions={false}
		/>
	);
}
