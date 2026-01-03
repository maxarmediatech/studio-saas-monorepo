"use client";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { cn } from "@repo/ui/lib/utils";
import type { Table } from "@tanstack/react-table";
import { SearchIcon, XIcon } from "lucide-react";
import * as React from "react";
import {
	DataTableDateFilter,
	type DateFilterValue,
} from "./DataTableDateFilter";
import { DataTableFacetedFilter } from "./DataTableFacetedFilter";
import { DataTableViewOptions } from "./DataTableViewOptions";
import type { FilterOption, FilterVariant } from "./types";

/**
 * Filter configuration for the toolbar.
 * Each filter maps to a URL parameter and renders appropriate UI.
 */
export interface ToolbarFilterConfig {
	/** Unique identifier for the filter (used as URL param key) */
	id: string;
	/** Display label */
	label: string;
	/** Filter variant - determines which component to render */
	variant: FilterVariant;
	/** Placeholder for text/number inputs */
	placeholder?: string;
	/** Options for select/multiSelect variants */
	options?: FilterOption[];
	/** Icon to display */
	icon?: React.ComponentType<{ className?: string }>;
}

/**
 * Current filter values - a map of filter IDs to their values.
 * Values can be:
 * - string: for text, number, single select, single date
 * - string[]: for multiSelect
 * - { from?: string; to?: string }: for dateRange
 * - null: cleared/no filter
 */
export type ToolbarFilterValues = Record<
	string,
	string | string[] | { from?: string; to?: string } | null | undefined
>;

interface DataTableToolbarProps<TData> extends React.ComponentProps<"div"> {
	/** TanStack Table instance (for column visibility) */
	table?: Table<TData>;
	/** Filter configurations */
	filters?: ToolbarFilterConfig[];
	/** Current filter values */
	filterValues?: ToolbarFilterValues;
	/** Callback when a filter value changes */
	onFilterChange?: (
		filterId: string,
		value: ToolbarFilterValues[string],
	) => void;
	/** Callback to reset all filters */
	onResetFilters?: () => void;
	/** Whether any filter is active */
	isFiltered?: boolean;
	/** Show search input */
	showSearch?: boolean;
	/** Search value */
	searchValue?: string;
	/** Search placeholder */
	searchPlaceholder?: string;
	/** Callback when search changes */
	onSearchChange?: (value: string) => void;
	/** Show column visibility toggle */
	showViewOptions?: boolean;
}

export function DataTableToolbar<TData>({
	table,
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
	children,
	className,
	...props
}: DataTableToolbarProps<TData>) {
	const [localSearchValue, setLocalSearchValue] = React.useState(searchValue);

	// Sync local search with prop
	React.useEffect(() => {
		setLocalSearchValue(searchValue);
	}, [searchValue]);

	const handleSearchChange = React.useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const value = e.target.value;
			setLocalSearchValue(value);
			onSearchChange?.(value);
		},
		[onSearchChange],
	);

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
				// TODO: Add slider/range filter component
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
		<div
			role="toolbar"
			aria-orientation="horizontal"
			className={cn(
				"flex w-full items-start justify-between gap-2 p-1",
				className,
			)}
			{...props}
		>
			<div className="flex flex-1 flex-wrap items-center gap-2">
				{/* Search input */}
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

				{/* Dynamic filters */}
				{filters.map(renderFilter)}

				{/* Reset button */}
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
				{showViewOptions && table && (
					<DataTableViewOptions table={table} />
				)}
			</div>
		</div>
	);
}
