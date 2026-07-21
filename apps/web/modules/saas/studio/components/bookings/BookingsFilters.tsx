"use client";

import {
	DataTableExportButton,
	DataTableToolbarWithViews,
	type ToolbarFilterConfig,
} from "@saas/shared/components/data-table";
import type { SavedView } from "@saas/shared/components/views";
import { useBookingsTableWithViews } from "@saas/studio/hooks/tables";
import { configurationsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { CalendarIcon, CircleIcon, PackageIcon, TagIcon } from "lucide-react";
import { useCallback, useMemo } from "react";

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
	} = useBookingsTableWithViews();

	const { data: bookingTypesData } = useQuery(
		configurationsApi.bookingTypesOptions(),
	);
	const { data: packageTypesData } = useQuery(
		configurationsApi.packageTypesOptions(),
	);

	const filterConfigs: ToolbarFilterConfig[] = useMemo(
		() => [
			{
				id: "statuses",
				label: "Status",
				variant: "multiSelect",
				options: STATUS_OPTIONS,
			},
			{
				id: "bookingType",
				label: "Booking Type",
				variant: "multiSelect",
				icon: TagIcon,
				options: (bookingTypesData?.data ?? []).map((c) => ({
					value: c.key,
					label: c.label,
				})),
			},
			{
				id: "packageType",
				label: "Package",
				variant: "multiSelect",
				icon: PackageIcon,
				options: (packageTypesData?.data ?? []).map((c) => ({
					value: c.key,
					label: c.label,
				})),
			},
			{
				id: "bookingDate",
				label: "Booking Date",
				variant: "dateRange",
				icon: CalendarIcon,
			},
		],
		[bookingTypesData, packageTypesData],
	);

	const filterValues = useMemo(
		() => ({
			statuses: filters.statuses ?? [],
			bookingType: filters.bookingType ?? [],
			packageType: filters.packageType ?? [],
			bookingDate:
				(filters.bookingDate && filters.bookingDate.length > 0) ||
				(filters.createdAt && filters.createdAt.length > 0)
					? {
							from:
								filters.bookingDate?.[0] ??
								filters.createdAt?.[0] ??
								undefined,
							to:
								filters.bookingDate?.[1] ??
								filters.createdAt?.[1] ??
								undefined,
						}
					: null,
		}),
		[
			filters.statuses,
			filters.bookingType,
			filters.packageType,
			filters.bookingDate,
			filters.createdAt,
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
			if (filterId === "statuses") {
				const statusValues =
					Array.isArray(value) && value.length > 0 ? value : null;
				setFilter("statuses", statusValues as typeof filters.statuses);
			} else if (filterId === "bookingType") {
				const values =
					Array.isArray(value) && value.length > 0 ? value : null;
				setFilter("bookingType", values);
			} else if (filterId === "packageType") {
				const values =
					Array.isArray(value) && value.length > 0 ? value : null;
				setFilter("packageType", values);
			} else if (filterId === "bookingDate") {
				if (
					value &&
					typeof value === "object" &&
					!Array.isArray(value)
				) {
					const dateRange = value as { from?: string; to?: string };
					const dates = [dateRange.from, dateRange.to].filter(
						(d): d is string => !!d,
					);
					setFilter("bookingDate", dates.length > 0 ? dates : null);
				} else {
					setFilter("bookingDate", null);
				}
			}
		},
		[setFilter, filters.statuses],
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
		statuses: filters.statuses ?? undefined,
		bookingType: filters.bookingType ?? undefined,
		packageType: filters.packageType ?? undefined,
		bookingDate:
			filters.bookingDate?.join(",") ??
			filters.createdAt?.join(",") ??
			undefined,
		sortBy: sorting.sortBy ?? "bookingDate",
		sortDirection: sorting.sortDirection,
		includeDeleted: false,
	};

	return (
		<DataTableToolbarWithViews
			entityType="booking"
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
			searchPlaceholder="Search name, client, reference or amount..."
			onSearchChange={handleSearchChange}
			showViewOptions={false}
		>
			<DataTableExportButton
				entityType="booking"
				input={queryInput}
				columnVisibility={columnVisibility}
				iconOnly
			/>
		</DataTableToolbarWithViews>
	);
}
