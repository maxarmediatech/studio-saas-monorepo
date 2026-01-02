"use client";

import {
	DataTableToolbar,
	type ToolbarFilterConfig,
} from "@saas/shared/components/data-table";
import { useBookingsTable } from "@saas/studio/hooks/tables";
import { CircleIcon } from "lucide-react";
import { useMemo } from "react";

/**
 * Status options for the booking status filter.
 * These are static since booking phases are system-defined.
 */
const STATUS_OPTIONS = [
	{
		label: "New",
		value: "new",
		icon: ({ className }: { className?: string }) => (
			<CircleIcon
				className={`${className} fill-yellow-400 text-yellow-400`}
			/>
		),
	},
	{
		label: "Preparation",
		value: "preparation",
		icon: ({ className }: { className?: string }) => (
			<CircleIcon
				className={`${className} fill-blue-400 text-blue-400`}
			/>
		),
	},
	{
		label: "Shooting",
		value: "shooting",
		icon: ({ className }: { className?: string }) => (
			<CircleIcon
				className={`${className} fill-purple-400 text-purple-400`}
			/>
		),
	},
	{
		label: "Delivery",
		value: "delivery",
		icon: ({ className }: { className?: string }) => (
			<CircleIcon
				className={`${className} fill-orange-400 text-orange-400`}
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
		label: "Cancelled",
		value: "cancelled",
		icon: ({ className }: { className?: string }) => (
			<CircleIcon
				className={`${className} fill-gray-400 text-gray-400`}
			/>
		),
	},
];

export function BookingsFilters() {
	// Use the bookings table hook for URL-synced state
	const { filters, setFilter, resetFilters, isFiltered } = useBookingsTable();

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
			status: filters.status ? [filters.status] : [],
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
			// For multiSelect, take the first value or null
			const statusValue =
				Array.isArray(value) && value.length > 0 ? value[0] : null;
			setFilter("status", statusValue as typeof filters.status);
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
			searchPlaceholder="Search bookings..."
			onSearchChange={handleSearchChange}
			showViewOptions={false}
		/>
	);
}
