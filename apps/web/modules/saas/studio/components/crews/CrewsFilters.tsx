"use client";

import {
	DataTableExportButton,
	DataTableToolbarWithViews,
	type ToolbarFilterConfig,
} from "@saas/shared/components/data-table";
import type { SavedView } from "@saas/shared/components/views";
import { useCrewsTableWithViews } from "@saas/studio/hooks/tables";
import { configurationsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { BriefcaseIcon, ShieldCheckIcon, UserIcon } from "lucide-react";
import { useCallback, useMemo } from "react";

const statusOptions = [
	{ value: "active", label: "Active" },
	{ value: "inactive", label: "Inactive" },
	{ value: "unavailable", label: "Unavailable" },
];

const accessOptions = [
	{ value: "true", label: "Has Access" },
	{ value: "false", label: "No Access" },
];

export function CrewsFilters() {
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
			{
				id: "hasAppAccess",
				label: "Access",
				variant: "multiSelect",
				icon: ShieldCheckIcon,
				options: accessOptions,
			},
		],
		[specializationOptions],
	);

	const filterValues = useMemo(
		() => ({
			status: filters.status ?? [],
			specializations: filters.specializations ?? [],
			hasAppAccess: filters.hasAppAccess ?? [],
		}),
		[filters.hasAppAccess, filters.specializations, filters.status],
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
			} else if (filterId === "hasAppAccess") {
				const values =
					Array.isArray(value) && value.length > 0 ? value : null;
				setFilter("hasAppAccess", values);
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

	const workerType = filters.workerType?.filter(
		(value): value is "internal" | "freelancer" =>
			value === "internal" || value === "freelancer",
	);
	const hasAppAccess = filters.hasAppAccess?.filter(
		(value): value is "true" | "false" =>
			value === "true" || value === "false",
	);
	const queryInput = {
		page: pagination.page,
		limit: pagination.limit,
		search: filters.search ?? undefined,
		status: filters.status ?? undefined,
		specializations: filters.specializations ?? undefined,
		workerType:
			workerType && workerType.length > 0 ? workerType : undefined,
		hasAppAccess:
			hasAppAccess && hasAppAccess.length > 0 ? hasAppAccess : undefined,
		sortBy: sorting.sortBy ?? "name",
		sortDirection: sorting.sortDirection,
		includeDeleted: false,
	};

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
			searchPlaceholder="Search people..."
			onSearchChange={handleSearchChange}
			showViewOptions={false}
		>
			<DataTableExportButton
				entityType="crew"
				input={queryInput}
				columnVisibility={columnVisibility}
				iconOnly
			/>
		</DataTableToolbarWithViews>
	);
}
