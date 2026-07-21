"use client";

import {
	DataTableExportButton,
	DataTableToolbarWithViews,
	type ToolbarFilterConfig,
} from "@saas/shared/components/data-table";
import type { SavedView } from "@saas/shared/components/views";
import {
	getBookingFilterValue,
	parseBookingFilterValue,
	useBookingFilterConfig,
} from "@saas/studio/components/shared/booking-filter";
import { useDeliverablesTableWithViews } from "@saas/studio/hooks/tables";
import { CircleIcon } from "lucide-react";
import { useCallback, useMemo } from "react";

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
	const {
		filters,
		setFilter,
		resetFilters,
		isFiltered,
		activeViewId,
		applyView,
		pagination,
		sorting,
		sortingState,
		columnVisibility,
	} = useDeliverablesTableWithViews();
	const bookingFilterConfig = useBookingFilterConfig();

	const filterConfigs: ToolbarFilterConfig[] = useMemo(
		() => [
			{
				id: "status",
				label: "Status",
				variant: "multiSelect",
				options: STATUS_OPTIONS,
			},
			bookingFilterConfig,
		],
		[bookingFilterConfig],
	);

	const filterValues = useMemo(
		() => ({
			bookingId: getBookingFilterValue(filters.bookingId),
			status: filters.status ?? [],
		}),
		[filters.bookingId, filters.status],
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
			if (filterId === "bookingId") {
				setFilter("bookingId", parseBookingFilterValue(value));
			} else if (filterId === "status") {
				const values =
					Array.isArray(value) && value.length > 0 ? value : null;
				setFilter("status", values);
			}
		},
		[setFilter],
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

	const queryInput = {
		page: pagination.page,
		limit: pagination.limit,
		search: filters.search ?? undefined,
		bookingId: filters.bookingId ?? undefined,
		status: filters.status ?? undefined,
		sortBy: sorting.sortBy ?? "dueDate",
		sortDirection: sorting.sortDirection,
		includeDeleted: false,
	};

	return (
		<DataTableToolbarWithViews
			entityType="deliverable"
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
			searchPlaceholder="Search deliverable, client, booking, description or crew..."
			onSearchChange={handleSearchChange}
			showViewOptions={false}
		>
			<DataTableExportButton
				entityType="deliverable"
				input={queryInput}
				columnVisibility={columnVisibility}
				iconOnly
			/>
		</DataTableToolbarWithViews>
	);
}
