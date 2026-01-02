"use client";

import type { RowData } from "@tanstack/react-table";

/**
 * Filter variant types for data table columns.
 * Determines which filter component to render in the toolbar.
 */
export type FilterVariant =
	| "text"
	| "number"
	| "range"
	| "date"
	| "dateRange"
	| "select"
	| "multiSelect";

/**
 * Option type for select/multiSelect filter variants.
 */
export interface FilterOption {
	label: string;
	value: string;
	count?: number;
	icon?: React.ComponentType<{ className?: string }>;
}

/**
 * Augment TanStack Table's ColumnMeta to include filter configuration.
 * This allows columns to declaratively define their filter behavior.
 */
declare module "@tanstack/react-table" {
	// biome-ignore lint/correctness/noUnusedVariables: Required for module augmentation
	interface ColumnMeta<TData extends RowData, TValue> {
		/** Display label for the column (used in filters and visibility toggle) */
		label?: string;
		/** Placeholder text for text/number inputs */
		placeholder?: string;
		/** Filter variant - determines which filter component to render */
		variant?: FilterVariant;
		/** Options for select/multiSelect variants */
		options?: FilterOption[];
		/** Min/max range for range variant [min, max] */
		range?: [number, number];
		/** Unit suffix for number/range inputs (e.g., "km", "$") */
		unit?: string;
		/** Icon to display in the filter button */
		icon?: React.ComponentType<{ className?: string }>;

		// Sticky column configuration
		/** Fixed width for the column in pixels (used for sticky positioning) */
		width?: number;
		/** Minimum width for the column */
		minWidth?: number;
		/** Maximum width for the column */
		maxWidth?: number;
		/** Additional class name for the header cell */
		headerClassName?: string;
		/** Additional class name for the body cell */
		cellClassName?: string;
	}
}

export type { FilterOption as Option };
