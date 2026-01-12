"use client";

import type { ToolbarFilterConfig } from "@saas/shared/components/data-table";
import { DataTableToolbarWithViews } from "@saas/shared/components/data-table";
import type { SavedView } from "@saas/shared/components/views";
import { useCrewsTableWithViews } from "@saas/studio/hooks/tables";
import { BriefcaseIcon, UserIcon } from "lucide-react";
import { useCallback, useMemo } from "react";

const statusOptions = [
	{ value: "active", label: "Active" },
	{ value: "inactive", label: "Inactive" },
	{ value: "unavailable", label: "Unavailable" },
];

const roleOptions = [
	{ value: "photographer", label: "Photographer" },
	{ value: "videographer", label: "Videographer" },
	{ value: "editor", label: "Editor" },
	{ value: "assistant", label: "Assistant" },
	{ value: "makeup_artist", label: "Makeup Artist" },
	{ value: "coordinator", label: "Coordinator" },
	{ value: "other", label: "Other" },
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
				id: "role",
				label: "Role",
				variant: "multiSelect",
				icon: BriefcaseIcon,
				options: roleOptions,
			},
		],
		[],
	);

	const filterValues = useMemo(
		() => ({
			status: filters.status ?? [],
			role: filters.role ?? [],
		}),
		[filters.status, filters.role],
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
			} else if (filterId === "role") {
				const values =
					Array.isArray(value) && value.length > 0 ? value : null;
				setFilter("role", values);
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
