"use client";

import {
	DataTableExportButton,
	DataTableToolbarWithViews,
	type ToolbarFilterConfig,
} from "@saas/shared/components/data-table";
import type { SavedView } from "@saas/shared/components/views";
import { useInvoicesTableWithViews } from "@saas/studio/hooks/tables/use-invoices-table-with-views";
import { CalendarIcon, CircleIcon } from "lucide-react";
import { useCallback, useMemo } from "react";

const STATUS_OPTIONS = [
	{
		label: "Draft",
		value: "draft",
		icon: ({ className }: { className?: string }) => (
			<CircleIcon
				className={`${className} fill-gray-400 text-gray-400`}
			/>
		),
	},
	{
		label: "Sent",
		value: "sent",
		icon: ({ className }: { className?: string }) => (
			<CircleIcon
				className={`${className} fill-blue-400 text-blue-400`}
			/>
		),
	},
	{
		label: "Paid",
		value: "paid",
		icon: ({ className }: { className?: string }) => (
			<CircleIcon
				className={`${className} fill-green-400 text-green-400`}
			/>
		),
	},
	{
		label: "Partial",
		value: "partial",
		icon: ({ className }: { className?: string }) => (
			<CircleIcon
				className={`${className} fill-yellow-400 text-yellow-400`}
			/>
		),
	},
	{
		label: "Overdue",
		value: "overdue",
		icon: ({ className }: { className?: string }) => (
			<CircleIcon className={`${className} fill-red-400 text-red-400`} />
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

export function InvoicesFilters() {
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
	} = useInvoicesTableWithViews();

	const filterConfigs: ToolbarFilterConfig[] = useMemo(
		() => [
			{
				id: "statuses",
				label: "Status",
				variant: "multiSelect",
				options: STATUS_OPTIONS,
			},
			{
				id: "createdAt",
				label: "Date",
				variant: "dateRange",
				icon: CalendarIcon,
			},
		],
		[],
	);

	const filterValues = useMemo(
		() => ({
			statuses: filters.statuses ?? [],
			createdAt:
				filters.createdAt && filters.createdAt.length > 0
					? {
							from: filters.createdAt[0] ?? undefined,
							to: filters.createdAt[1] ?? undefined,
						}
					: null,
		}),
		[filters.statuses, filters.createdAt],
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
			} else if (filterId === "createdAt") {
				if (
					value &&
					typeof value === "object" &&
					!Array.isArray(value)
				) {
					const dateRange = value as { from?: string; to?: string };
					const dates = [dateRange.from, dateRange.to].filter(
						(d): d is string => !!d,
					);
					setFilter("createdAt", dates.length > 0 ? dates : null);
				} else {
					setFilter("createdAt", null);
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
		status: filters.statuses ?? undefined,
		bookingId: filters.bookingId ?? undefined,
		clientId: filters.clientId ?? undefined,
		dateFrom: filters.createdAt?.[0] ?? undefined,
		dateTo: filters.createdAt?.[1] ?? undefined,
		sortBy: sorting.sortBy ?? "createdAt",
		sortDirection: sorting.sortDirection,
		includeDeleted: false,
	};

	return (
		<DataTableToolbarWithViews
			entityType="invoice"
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
			searchPlaceholder="Search invoices..."
			onSearchChange={handleSearchChange}
			showViewOptions={false}
		>
			<DataTableExportButton
				entityType="invoice"
				input={queryInput}
				columnVisibility={columnVisibility}
				iconOnly
			/>
		</DataTableToolbarWithViews>
	);
}
