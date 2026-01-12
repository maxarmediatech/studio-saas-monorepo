"use client";

import type { ToolbarFilterConfig } from "@saas/shared/components/data-table";
import { DataTableToolbarWithViews } from "@saas/shared/components/data-table";
import type { SavedView } from "@saas/shared/components/views";
import { useTasksTableWithViews } from "@saas/studio/hooks/tables";
import {
	AlertTriangleIcon,
	CheckCircle2Icon,
	CircleIcon,
	PlayCircleIcon,
	XCircleIcon,
} from "lucide-react";
import { useCallback, useMemo } from "react";

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

const PRIORITY_OPTIONS = [
	{ label: "High", value: "high" },
	{ label: "Medium", value: "medium" },
	{ label: "Low", value: "low" },
];

export function TasksFilters() {
	const {
		filters,
		setFilter,
		resetFilters,
		isFiltered,
		activeViewId,
		applyView,
		sortingState,
		columnVisibility,
	} = useTasksTableWithViews();

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

	const filterValues = useMemo(
		() => ({
			status: filters.status ?? [],
			priority: filters.priority ?? [],
		}),
		[filters.status, filters.priority],
	);

	const handleFilterChange = useCallback(
		(
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
				setFilter(
					"priority",
					priorityValues as typeof filters.priority,
				);
			}
		},
		[setFilter, filters.status, filters.priority],
	);

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
			entityType="task"
			activeViewId={activeViewId}
			onViewSelect={handleViewSelect}
			getCurrentFilters={getCurrentFilters}
			getCurrentSorting={getCurrentSorting}
			getCurrentColumnVisibility={getCurrentColumnVisibility}
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
