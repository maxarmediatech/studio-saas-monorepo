"use client";

import {
	DataTableExportButton,
	DataTableToolbar,
	type ToolbarFilterConfig,
} from "@saas/shared/components/data-table";
import {
	getBookingFilterValue,
	parseBookingFilterValue,
	useBookingFilterConfig,
} from "@saas/studio/components/shared/booking-filter";
import { useReceiptsTable } from "@saas/studio/hooks/tables/use-receipts-table";
import { CalendarIcon } from "lucide-react";
import { useCallback, useMemo } from "react";

export function ReceiptsFilters() {
	const {
		filters,
		pagination,
		sorting,
		setFilter,
		resetFilters,
		isFiltered,
		columnVisibility,
	} = useReceiptsTable();
	const bookingFilterConfig = useBookingFilterConfig();

	const filterConfigs: ToolbarFilterConfig[] = useMemo(
		() => [
			{
				id: "createdAt",
				label: "Date",
				variant: "dateRange",
				icon: CalendarIcon,
			},
			bookingFilterConfig,
		],
		[bookingFilterConfig],
	);

	const filterValues = useMemo(
		() => ({
			bookingId: getBookingFilterValue(filters.bookingId),
			createdAt:
				filters.createdAt && filters.createdAt.length > 0
					? {
							from: filters.createdAt[0] ?? undefined,
							to: filters.createdAt[1] ?? undefined,
						}
					: null,
		}),
		[filters.bookingId, filters.createdAt],
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
		[setFilter],
	);

	const handleSearchChange = useCallback(
		(value: string) => {
			setFilter("search", value || null);
		},
		[setFilter],
	);

	const queryInput = {
		page: pagination.page,
		limit: pagination.limit,
		search: filters.search ?? undefined,
		bookingId: filters.bookingId ?? undefined,
		invoiceId: filters.invoiceId ?? undefined,
		paymentScheduleId: filters.paymentScheduleId ?? undefined,
		dateFrom: filters.createdAt?.[0] ?? undefined,
		dateTo: filters.createdAt?.[1] ?? undefined,
		sortBy: sorting.sortBy ?? "receiptDate",
		sortDirection: sorting.sortDirection,
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
			searchPlaceholder="Search receipts..."
			onSearchChange={handleSearchChange}
		>
			<DataTableExportButton
				entityType="receipt"
				input={queryInput}
				columnVisibility={columnVisibility}
				iconOnly
			/>
		</DataTableToolbar>
	);
}
