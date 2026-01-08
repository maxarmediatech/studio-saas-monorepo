"use client";

import {
	DataTableToolbar,
	type ToolbarFilterConfig,
} from "@saas/shared/components/data-table";
import { useTasksTable } from "@saas/studio/hooks/tables";
import {
	AlertTriangleIcon,
	CheckCircle2Icon,
	CircleIcon,
	PlayCircleIcon,
	XCircleIcon,
} from "lucide-react";
import { useMemo } from "react";

/**
 * Status options for the task status filter.
 */
const STATUS_OPTIONS = [
	{
		label: "Pending",
		value: "pending",
		icon: ({ className }: { className?: string }) => (
			<CircleIcon className={`${className} text-gray-400`} />
		),
	},
	{
		label: "In Progress",
		value: "in_progress",
		icon: ({ className }: { className?: string }) => (
			<PlayCircleIcon className={`${className} text-blue-600`} />
		),
	},
	{
		label: "Completed",
		value: "completed",
		icon: ({ className }: { className?: string }) => (
			<CheckCircle2Icon className={`${className} text-green-600`} />
		),
	},
	{
		label: "Cancelled",
		value: "cancelled",
		icon: ({ className }: { className?: string }) => (
			<XCircleIcon className={`${className} text-gray-400`} />
		),
	},
];

/**
 * Priority options for the task priority filter.
 */
const PRIORITY_OPTIONS = [
	{
		label: "High",
		value: "high",
	},
	{
		label: "Medium",
		value: "medium",
	},
	{
		label: "Low",
		value: "low",
	},
];

export function TasksFilters() {
	// Use the tasks table hook for URL-synced state
	const { filters, setFilter, resetFilters, isFiltered } = useTasksTable();

	// Define filter configurations
	const filterConfigs: ToolbarFilterConfig[] = useMemo(
		() => [
			{
				id: "status",
				label: "Status",
				variant: "multiSelect",
				options: STATUS_OPTIONS,
			},
			{
				id: "priority",
				label: "Priority",
				variant: "multiSelect",
				icon: AlertTriangleIcon,
				options: PRIORITY_OPTIONS,
			},
		],
		[],
	);

	// Convert filters to toolbar format
	const filterValues = useMemo(
		() => ({
			status: filters.status ?? [],
			priority: filters.priority ?? [],
		}),
		[filters.status, filters.priority],
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
			const statusValues =
				Array.isArray(value) && value.length > 0 ? value : null;
			setFilter("status", statusValues as typeof filters.status);
		} else if (filterId === "priority") {
			const priorityValues =
				Array.isArray(value) && value.length > 0 ? value : null;
			setFilter("priority", priorityValues as typeof filters.priority);
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
			searchPlaceholder="Search tasks..."
			onSearchChange={handleSearchChange}
			showViewOptions={false}
		/>
	);
}
