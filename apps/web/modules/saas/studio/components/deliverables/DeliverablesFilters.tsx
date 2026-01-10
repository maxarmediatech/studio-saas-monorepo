"use client";

import {
	DataTableToolbar,
	type ToolbarFilterConfig,
} from "@saas/shared/components/data-table";
import { useDeliverablesTable } from "@saas/studio/hooks/tables";
import { CircleIcon } from "lucide-react";
import { useMemo } from "react";

/**
 * Status options for the status filter.
 */
const STATUS_OPTIONS = [
	{
		label: "Pending",
		value: "pending",
		icon: ({ className }: { className?: string }) => (
			<CircleIcon
				className={`${className} fill-gray-400 text-gray-400`}
			/>
		),
	},
	{
		label: "In Progress",
		value: "in_progress",
		icon: ({ className }: { className?: string }) => (
			<CircleIcon
				className={`${className} fill-blue-400 text-blue-400`}
			/>
		),
	},
	{
		label: "Completed",
		value: "completed",
		icon: ({ className }: { className?: string }) => (
			<CircleIcon
				className={`${className} fill-green-400 text-green-400`}
			/>
		),
	},
	{
		label: "Delivered",
		value: "delivered",
		icon: ({ className }: { className?: string }) => (
			<CircleIcon
				className={`${className} fill-purple-400 text-purple-400`}
			/>
		),
	},
];

export function DeliverablesFilters() {
	// Use the deliverables table hook for URL-synced state
	const { filters, setFilter, resetFilters, isFiltered } =
		useDeliverablesTable();

	// Define filter configurations
	const filterConfigs: ToolbarFilterConfig[] = useMemo(
		() => [
			{
				id: "status",
				label: "Status",
				variant: "multiSelect",
				options: STATUS_OPTIONS,
			},
		],
		[],
	);

	// Convert filters to toolbar format
	const filterValues = useMemo(
		() => ({
			status: filters.status ?? [],
		}),
		[filters.status],
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
			const values =
				Array.isArray(value) && value.length > 0 ? value : null;
			setFilter("status", values);
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
			searchPlaceholder="Search deliverables..."
			onSearchChange={handleSearchChange}
			showViewOptions={false}
		/>
	);
}
