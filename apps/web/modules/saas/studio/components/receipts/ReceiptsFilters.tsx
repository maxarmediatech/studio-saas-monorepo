"use client";

import type { ToolbarFilterConfig } from "@saas/shared/components/data-table";
import { DataTableToolbar } from "@saas/shared/components/data-table";
import { useReceiptsTable } from "@saas/studio/hooks/tables/use-receipts-table";
import { CalendarIcon } from "lucide-react";
import { useCallback, useMemo } from "react";

export function ReceiptsFilters() {
	const { filters, setFilter, resetFilters, isFiltered } = useReceiptsTable();

	const filterConfigs: ToolbarFilterConfig[] = useMemo(
		() => [
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
			createdAt:
				filters.createdAt && filters.createdAt.length > 0
					? {
							from: filters.createdAt[0] ?? undefined,
							to: filters.createdAt[1] ?? undefined,
						}
					: null,
		}),
		[filters.createdAt],
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
			if (filterId === "createdAt") {
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
		/>
	);
}
