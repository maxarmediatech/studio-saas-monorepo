"use client";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { cn } from "@repo/ui/lib/utils";
import type {
	LayoutType,
	SavedView,
	SavedViewEntityType,
} from "@saas/shared/components/views";
import {
	CollapsibleFilterBar,
	LayoutSwitcher,
	SaveViewDialog,
	useSavedViews,
	ViewSelector,
} from "@saas/shared/components/views";
import type { Table } from "@tanstack/react-table";
import { SearchIcon, XIcon } from "lucide-react";
import { useCallback, useState } from "react";
import {
	DataTableDateFilter,
	type DateFilterValue,
} from "./DataTableDateFilter";
import { DataTableFacetedFilter } from "./DataTableFacetedFilter";
import type {
	ToolbarFilterConfig,
	ToolbarFilterValues,
} from "./DataTableToolbar";
import { DataTableViewOptions } from "./DataTableViewOptions";

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
	const { views, isLoading, createView, toggleFavorite, isCreating } =
		useSavedViews({ entityType });

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

	const activeFilters = filters
		.filter((f) => {
			const value = filterValues[f.id];
			if (value == null) {
				return false;
			}
			if (Array.isArray(value)) {
				return value.length > 0;
			}
			if (typeof value === "object") {
				return value.from || value.to;
			}
			return value !== "";
		})
		.map((f) => {
			const value = filterValues[f.id];
			let displayValue: string | string[];

			if (Array.isArray(value)) {
				displayValue = value.map((v) => {
					const opt = f.options?.find((o) => o.value === v);
					return opt?.label ?? v;
				});
			} else if (typeof value === "object" && value !== null) {
				const dateRange = value as { from?: string; to?: string };
				const parts: string[] = [];
				if (dateRange.from) {
					parts.push(dateRange.from);
				}
				if (dateRange.to) {
					parts.push(dateRange.to);
				}
				displayValue = parts.join(" - ");
			} else {
				const opt = f.options?.find((o) => o.value === value);
				displayValue = opt?.label ?? (value as string);
			}

			return {
				id: f.id,
				label: f.label,
				value: displayValue,
				icon: f.icon,
			};
		});

	const renderFilter = (filter: ToolbarFilterConfig) => {
		const value = filterValues[filter.id];

		switch (filter.variant) {
			case "text":
				return (
					<Input
						key={filter.id}
						placeholder={filter.placeholder ?? filter.label}
						value={(value as string) ?? ""}
						onChange={(e) =>
							onFilterChange?.(filter.id, e.target.value || null)
						}
						className="h-8 w-40 lg:w-56"
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
							onFilterChange?.(filter.id, e.target.value || null)
						}
						className="h-8 w-32"
					/>
				);

			default:
				return null;
		}
	};

	return (
		<>
			<div
				role="toolbar"
				aria-orientation="horizontal"
				className={cn("flex w-full flex-col gap-2 p-1", className)}
				{...props}
			>
				<div className="flex w-full items-start justify-between gap-2">
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

						{filters.map(renderFilter)}

						{isFiltered && onResetFilters && (
							<Button
								aria-label="Reset filters"
								variant="ghost"
								size="sm"
								className="h-8 px-2 lg:px-3"
								onClick={onResetFilters}
							>
								<XIcon className="mr-2 h-4 w-4" />
								Reset
							</Button>
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

				{activeFilters.length > 0 && (
					<CollapsibleFilterBar
						filters={activeFilters}
						onRemoveFilter={(id) => onFilterChange?.(id, null)}
						onAddFilter={() => {}}
						onClearAll={onResetFilters}
					/>
				)}
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
