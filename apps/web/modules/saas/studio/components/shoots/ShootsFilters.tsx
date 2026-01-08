"use client";

import {
	DataTableToolbar,
	type ToolbarFilterConfig,
} from "@saas/shared/components/data-table";
import { SHOOT_TYPE_OPTIONS, useShootsTable } from "@saas/studio/hooks/tables";
import { configurationsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { CalendarIcon, CircleIcon, TagIcon } from "lucide-react";
import { useMemo } from "react";

// Default status labels (fallback if configuration not loaded)
const DEFAULT_STATUS_LABELS: Record<string, string> = {
	scheduled: "Scheduled",
	confirmed: "Confirmed",
	in_progress: "In Progress",
	completed: "Completed",
	cancelled: "Cancelled",
	postponed: "Postponed",
};

export function ShootsFilters() {
	// Use the shoots table hook for URL-synced state
	const { filters, setFilter, resetFilters, isFiltered } = useShootsTable();

	// Fetch shoot status configurations for filter options
	const { data: shootStatusData } = useQuery(
		configurationsApi.shootStatusOptions(),
	);

	// Build status options from configurations
	const statusOptions = useMemo(() => {
		if (shootStatusData?.data && shootStatusData.data.length > 0) {
			return shootStatusData.data.map((config) => ({
				value: config.key,
				label: config.label,
			}));
		}
		// Fallback to default statuses
		return Object.entries(DEFAULT_STATUS_LABELS).map(([key, label]) => ({
			value: key,
			label,
		}));
	}, [shootStatusData]);

	// Define filter configurations
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
		],
		[statusOptions],
	);

	// Convert filters to toolbar format
	const filterValues = useMemo(
		() => ({
			shootType: filters.shootType ?? [],
			status: filters.status ?? [],
			// Convert array [from, to] to { from, to } object for dateRange filter
			shootDate:
				filters.shootDate && filters.shootDate.length > 0
					? {
							from: filters.shootDate[0] ?? undefined,
							to: filters.shootDate[1] ?? undefined,
						}
					: null,
		}),
		[filters.shootType, filters.status, filters.shootDate],
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
		if (filterId === "shootType") {
			const values =
				Array.isArray(value) && value.length > 0 ? value : null;
			setFilter("shootType", values);
		} else if (filterId === "status") {
			const values =
				Array.isArray(value) && value.length > 0 ? value : null;
			setFilter("status", values);
		} else if (filterId === "shootDate") {
			// DataTableDateFilter returns { from?: string, to?: string } or null
			if (value && typeof value === "object" && !Array.isArray(value)) {
				const dateRange = value as { from?: string; to?: string };
				const dates = [dateRange.from, dateRange.to].filter(
					(d): d is string => !!d,
				);
				setFilter("shootDate", dates.length > 0 ? dates : null);
			} else {
				setFilter("shootDate", null);
			}
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
			searchPlaceholder="Search shoots..."
			onSearchChange={handleSearchChange}
			showViewOptions={false}
		/>
	);
}
