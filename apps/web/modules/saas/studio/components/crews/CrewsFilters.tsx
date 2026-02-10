"use client";

import type { ToolbarFilterConfig } from "@saas/shared/components/data-table";
import { DataTableToolbarWithViews } from "@saas/shared/components/data-table";
import type { SavedView } from "@saas/shared/components/views";
import { useCrewsTableWithViews } from "@saas/studio/hooks/tables";
import { configurationsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { BriefcaseIcon, UserIcon } from "lucide-react";
import { useCallback, useMemo } from "react";

const statusOptions = [
	{ value: "active", label: "Active" },
	{ value: "inactive", label: "Inactive" },
	{ value: "unavailable", label: "Unavailable" },
];

export function CrewsFilters() {
	const {
		filters,
		setFilter,
		resetFilters,
		isFiltered,
		activeViewId,
		applyView,
		sortingState,
		columnVisibility,
	} = useCrewsTableWithViews();
	const { data: specializationData } = useQuery(
		configurationsApi.specialisationsOptions(),
	);
	const specializationOptions =
		specializationData?.data?.map((item) => ({
			value: item.key,
			label: item.label,
		})) ?? [];

	const filterConfigs: ToolbarFilterConfig[] = useMemo(
		() => [
			{
				id: "status",
				label: "Status",
				variant: "multiSelect",
				icon: UserIcon,
				options: statusOptions,
			},
			{
				id: "specializations",
				label: "Specialisations",
				variant: "multiSelect",
				icon: BriefcaseIcon,
				options: specializationOptions,
			},
		],
		[specializationOptions],
	);

	const filterValues = useMemo(
		() => ({
			status: filters.status ?? [],
			specializations: filters.specializations ?? [],
		}),
		[filters.status, filters.specializations],
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
				const values =
					Array.isArray(value) && value.length > 0 ? value : null;
				setFilter("status", values);
			} else if (filterId === "specializations") {
				const values =
					Array.isArray(value) && value.length > 0 ? value : null;
				setFilter("specializations", values);
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

	return (
		<DataTableToolbarWithViews
			entityType="crew"
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
			searchPlaceholder="Search crew members..."
			onSearchChange={handleSearchChange}
			showViewOptions={false}
		/>
	);
}
