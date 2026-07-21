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
import {
	SHOOT_TYPE_OPTIONS,
	useShootsTableWithViews,
} from "@saas/studio/hooks/tables";
import { configurationsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { CalendarIcon, CircleIcon, TagIcon } from "lucide-react";
import { useCallback, useMemo } from "react";

const DEFAULT_STATUS_LABELS: Record<string, string> = {
	scheduled: "Scheduled",
	confirmed: "Confirmed",
	in_progress: "In Progress",
	completed: "Completed",
	cancelled: "Cancelled",
	postponed: "Postponed",
};

export function ShootsFilters() {
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
	} = useShootsTableWithViews();

	const { data: shootStatusData } = useQuery(
		configurationsApi.shootStatusOptions(),
	);
	const bookingFilterConfig = useBookingFilterConfig();

	const statusOptions = useMemo(() => {
		if (shootStatusData?.data && shootStatusData.data.length > 0) {
			return shootStatusData.data.map((config) => ({
				value: config.key,
				label: config.label,
			}));
		}
		return Object.entries(DEFAULT_STATUS_LABELS).map(([key, label]) => ({
			value: key,
			label,
		}));
	}, [shootStatusData]);

	const filterConfigs: ToolbarFilterConfig[] = useMemo(
		() => [
			{
				id: "shootType",
				label: "Type",
				variant: "multiSelect",
				icon: TagIcon,
				options: SHOOT_TYPE_OPTIONS,
			},
			{
				id: "status",
				label: "Status",
				variant: "multiSelect",
				icon: CircleIcon,
				options: statusOptions,
			},
			{
				id: "shootDate",
				label: "Shoot Date",
				variant: "dateRange",
				icon: CalendarIcon,
			},
			bookingFilterConfig,
		],
		[bookingFilterConfig, statusOptions],
	);

	const filterValues = useMemo(
		() => ({
			bookingId: getBookingFilterValue(filters.bookingId),
			shootType: filters.shootType ?? [],
			status: filters.status ?? [],
			shootDate:
				filters.shootDate && filters.shootDate.length > 0
					? {
							from: filters.shootDate[0] ?? undefined,
							to: filters.shootDate[1] ?? undefined,
						}
					: null,
		}),
		[
			filters.bookingId,
			filters.shootType,
			filters.status,
			filters.shootDate,
		],
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
			} else if (filterId === "shootType") {
				const values =
					Array.isArray(value) && value.length > 0 ? value : null;
				setFilter("shootType", values);
			} else if (filterId === "status") {
				const values =
					Array.isArray(value) && value.length > 0 ? value : null;
				setFilter("status", values);
			} else if (filterId === "shootDate") {
				if (
					value &&
					typeof value === "object" &&
					!Array.isArray(value)
				) {
					const dateRange = value as { from?: string; to?: string };
					const dates = [dateRange.from, dateRange.to].filter(
						(d): d is string => !!d,
					);
					setFilter("shootDate", dates.length > 0 ? dates : null);
				} else {
					setFilter("shootDate", null);
				}
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
		shootType: filters.shootType ?? undefined,
		status: filters.status ?? undefined,
		dateFrom: filters.shootDate?.[0] ?? undefined,
		dateTo: filters.shootDate?.[1] ?? undefined,
		sortBy: (sorting.sortBy ?? "shootDate") as
			| "name"
			| "shootDate"
			| "shootType"
			| "status"
			| "createdAt",
		sortDirection: sorting.sortDirection,
		includeDeleted: false,
	};

	return (
		<DataTableToolbarWithViews
			entityType="shoot"
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
			searchPlaceholder="Search shoot, client, booking, venue or crew..."
			onSearchChange={handleSearchChange}
			showViewOptions={false}
		>
			<DataTableExportButton
				entityType="shoot"
				input={queryInput}
				columnVisibility={columnVisibility}
				iconOnly
			/>
		</DataTableToolbarWithViews>
	);
}
