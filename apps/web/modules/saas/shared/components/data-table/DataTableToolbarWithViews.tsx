"use client";

import { Input } from "@repo/ui/components/input";
import { cn } from "@repo/ui/lib/utils";
import type {
	LayoutType,
	SavedView,
	SavedViewEntityType,
} from "@saas/shared/components/views";
import {
	LayoutSwitcher,
	SaveViewDialog,
	useSavedViews,
	ViewSelector,
} from "@saas/shared/components/views";
import type { Table } from "@tanstack/react-table";
import { SearchIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	DataTableDateFilter,
	type DateFilterValue,
} from "./DataTableDateFilter";
import { DataTableFacetedFilter } from "./DataTableFacetedFilter";
import { DataTableFilterRow } from "./data-table-filter-row";
import { DataTableFilterToggle } from "./data-table-filter-toggle";
import type {
	ToolbarFilterConfig,
	ToolbarFilterValues,
} from "./DataTableToolbar";
import { DataTableViewOptions } from "./DataTableViewOptions";
import { normalizeForCompare } from "./filter-row-utils";

const FILTER_ROW_STORAGE_KEY = "datatable-filter-row-visible";

interface DataTableToolbarWithViewsProps<TData>
	extends React.ComponentProps<"div"> {
	table?: Table<TData>;
	entityType: SavedViewEntityType;
	activeViewId: string | null;
	onViewSelect: (view: SavedView) => void;
	getCurrentFilters: () => Record<string, unknown>;
	getCurrentSorting: () => Array<{ id: string; desc: boolean }>;
	getCurrentColumnVisibility: () => Record<string, boolean>;
	filters?: ToolbarFilterConfig[];
	filterValues?: ToolbarFilterValues;
	onFilterChange?: (
		filterId: string,
		value: ToolbarFilterValues[string],
	) => void;
	onResetFilters?: () => void;
	isFiltered?: boolean;
	showSearch?: boolean;
	searchValue?: string;
	searchPlaceholder?: string;
	onSearchChange?: (value: string) => void;
	showViewOptions?: boolean;
	layout?: LayoutType;
	onLayoutChange?: (layout: LayoutType) => void;
	availableLayouts?: LayoutType[];
}

export function DataTableToolbarWithViews<TData>({
	table,
	entityType,
	activeViewId,
	onViewSelect,
	getCurrentFilters,
	getCurrentSorting,
	getCurrentColumnVisibility,
	filters = [],
	filterValues = {},
	onFilterChange,
	onResetFilters,
	isFiltered = false,
	showSearch = true,
	searchValue = "",
	searchPlaceholder = "Search...",
	onSearchChange,
	showViewOptions = true,
	layout = "table",
	onLayoutChange,
	availableLayouts,
	children,
	className,
	...props
}: DataTableToolbarWithViewsProps<TData>) {
	const [localSearchValue, setLocalSearchValue] = useState(searchValue);
	const [saveDialogOpen, setSaveDialogOpen] = useState(false);
	const [isFilterRowVisible, setIsFilterRowVisible] = useState(() => {
		if (typeof window === "undefined") {
			return false;
		}
		const stored = localStorage.getItem(FILTER_ROW_STORAGE_KEY);
		return stored === "true";
	});

	const {
		views,
		isLoading,
		createView,
		updateView,
		toggleFavorite,
		isCreating,
		isUpdating,
	} = useSavedViews({ entityType });

	const activeView = useMemo(
		() => views.find((v) => v.id === activeViewId),
		[views, activeViewId],
	);

	const hasViewChanges = useMemo(() => {
		if (!activeView) {
			return false;
		}

		const currentState = normalizeForCompare({
			filters: getCurrentFilters(),
			sorting: getCurrentSorting(),
			columnVisibility: getCurrentColumnVisibility(),
		});

		const viewState = normalizeForCompare({
			filters: activeView.filters,
			sorting: activeView.sorting,
			columnVisibility: activeView.columnVisibility,
		});

		return currentState !== viewState;
	}, [
		activeView,
		getCurrentFilters,
		getCurrentSorting,
		getCurrentColumnVisibility,
	]);

	useEffect(() => {
		localStorage.setItem(
			FILTER_ROW_STORAGE_KEY,
			String(isFilterRowVisible),
		);
	}, [isFilterRowVisible]);

	useEffect(() => {
		if (isFiltered && !isFilterRowVisible) {
			setIsFilterRowVisible(true);
		}
	}, [isFiltered, isFilterRowVisible]);

	const handleToggleFilterRow = useCallback(() => {
		setIsFilterRowVisible((prev) => !prev);
	}, []);

	const handleSearchChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const value = e.target.value;
			setLocalSearchValue(value);
			onSearchChange?.(value);
		},
		[onSearchChange],
	);

	const handleCreateView = useCallback(
		async (formData: {
			name: string;
			description?: string;
			icon?: string;
			color?: string;
			isPublic: boolean;
		}) => {
			await createView({
				entityType,
				name: formData.name,
				description: formData.description,
				icon: formData.icon,
				color: formData.color,
				isPublic: formData.isPublic,
				filters: getCurrentFilters(),
				sorting: getCurrentSorting(),
				columnVisibility: getCurrentColumnVisibility(),
			});
			setSaveDialogOpen(false);
		},
		[
			createView,
			entityType,
			getCurrentFilters,
			getCurrentSorting,
			getCurrentColumnVisibility,
		],
	);

	const handleUpdateView = useCallback(async () => {
		if (!activeView) {
			return;
		}

		await updateView({
			id: activeView.id,
			filters: getCurrentFilters(),
			sorting: getCurrentSorting(),
			columnVisibility: getCurrentColumnVisibility(),
		});
	}, [
		activeView,
		updateView,
		getCurrentFilters,
		getCurrentSorting,
		getCurrentColumnVisibility,
	]);

	const renderFilterControl = useCallback(
		(filter: ToolbarFilterConfig) => {
			const value = filterValues[filter.id];

			switch (filter.variant) {
				case "text":
					return (
						<Input
							key={filter.id}
							placeholder={filter.placeholder ?? filter.label}
							value={(value as string) ?? ""}
							onChange={(e) =>
								onFilterChange?.(
									filter.id,
									e.target.value || null,
								)
							}
							className="h-8 w-40"
						/>
					);

				case "select":
				case "multiSelect":
					return (
						<DataTableFacetedFilter
							key={filter.id}
							title={filter.label}
							options={filter.options ?? []}
							selectedValues={
								Array.isArray(value)
									? value
									: value
										? [value as string]
										: []
							}
							onSelectionChange={(values) =>
								onFilterChange?.(
									filter.id,
									values.length > 0 ? values : null,
								)
							}
							multiple={filter.variant === "multiSelect"}
							icon={filter.icon}
						/>
					);

				case "date":
				case "dateRange":
					return (
						<DataTableDateFilter
							key={filter.id}
							title={filter.label}
							value={value as DateFilterValue}
							onValueChange={(newValue) =>
								onFilterChange?.(filter.id, newValue)
							}
							multiple={filter.variant === "dateRange"}
							icon={filter.icon}
						/>
					);

				case "number":
				case "range":
					return (
						<Input
							key={filter.id}
							type="number"
							placeholder={filter.placeholder ?? filter.label}
							value={(value as string) ?? ""}
							onChange={(e) =>
								onFilterChange?.(
									filter.id,
									e.target.value || null,
								)
							}
							className="h-8 w-32"
						/>
					);

				default:
					return null;
			}
		},
		[filterValues, onFilterChange],
	);

	const filterControls = useMemo(
		() => filters.map(renderFilterControl),
		[filters, renderFilterControl],
	);

	return (
		<>
			<div
				role="toolbar"
				aria-orientation="horizontal"
				className={cn("flex w-full flex-col gap-0", className)}
				{...props}
			>
				<div className="flex w-full items-center justify-between gap-2 p-1">
					<div className="flex flex-1 flex-wrap items-center gap-2">
						<ViewSelector
							views={views}
							activeViewId={activeViewId}
							onViewSelect={onViewSelect}
							onCreateView={() => setSaveDialogOpen(true)}
							onToggleFavorite={toggleFavorite}
							isLoading={isLoading}
						/>

						{showSearch && onSearchChange && (
							<div className="relative">
								<SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									placeholder={searchPlaceholder}
									value={localSearchValue}
									onChange={handleSearchChange}
									className="h-8 w-40 pl-8 lg:w-64"
								/>
							</div>
						)}

						{filters.length > 0 && (
							<DataTableFilterToggle
								isOpen={isFilterRowVisible}
								hasActiveFilters={isFiltered}
								onToggle={handleToggleFilterRow}
							/>
						)}
					</div>

					<div className="flex items-center gap-2">
						{children}
						{onLayoutChange && (
							<LayoutSwitcher
								value={layout}
								onChange={onLayoutChange}
								availableLayouts={availableLayouts}
							/>
						)}
						{showViewOptions && table && (
							<DataTableViewOptions table={table} />
						)}
					</div>
				</div>

				<DataTableFilterRow
					visible={isFilterRowVisible}
					hasActiveFilters={isFiltered}
					onClearAll={onResetFilters}
					onSaveView={() => setSaveDialogOpen(true)}
					onUpdateView={handleUpdateView}
					showSaveView={isFiltered && !activeViewId}
					showUpdateView={
						hasViewChanges &&
						!!activeViewId &&
						!activeView?.isSystem
					}
					isUpdating={isUpdating}
					filterControls={filterControls}
				/>
			</div>

			<SaveViewDialog
				open={saveDialogOpen}
				onOpenChange={setSaveDialogOpen}
				onSave={handleCreateView}
				isLoading={isCreating}
			/>
		</>
	);
}
