"use client";

import { cn } from "@repo/ui/lib/utils";
import type { Table as ReactTable } from "@tanstack/react-table";
import * as React from "react";

export interface StickyColumnConfig {
	/** Column ID */
	id: string;
	/** Width of the column in pixels */
	width: number;
}

export interface UseStickyColumnsOptions<TData> {
	/** TanStack Table instance */
	table?: ReactTable<TData>;
	/** Configuration for left-pinned columns (in order from left to right) */
	leftColumns?: StickyColumnConfig[];
	/** Configuration for right-pinned columns (in order from left to right) */
	rightColumns?: StickyColumnConfig[];
}

/**
 * Hook for managing sticky (pinned) columns in a data table.
 * Calculates cumulative positions for left-pinned columns and provides
 * utility functions for applying sticky styles.
 */
export function useStickyColumns<TData>({
	table,
	leftColumns = [],
	rightColumns = [],
}: UseStickyColumnsOptions<TData>) {
	const isVisible = React.useCallback(
		(id: string) =>
			table
				?.getAllLeafColumns()
				.some((column) => column.id === id && column.getIsVisible()) ??
			true,
		[table],
	);

	// Calculate left positions for left-pinned columns
	const leftPositions = React.useMemo(() => {
		let position = 0;
		const positions: Record<string, number> = {};

		for (const col of leftColumns) {
			if (isVisible(col.id)) {
				positions[col.id] = position;
				position += col.width;
			}
		}

		return positions;
	}, [leftColumns, isVisible]);

	// Calculate right positions for right-pinned columns
	const rightPositions = React.useMemo(() => {
		let position = 0;
		const positions: Record<string, number> = {};

		// Process from right to left
		for (let i = rightColumns.length - 1; i >= 0; i--) {
			const col = rightColumns[i];
			if (col && isVisible(col.id)) {
				positions[col.id] = position;
				position += col.width;
			}
		}

		return positions;
	}, [rightColumns, isVisible]);

	const leftColumnIds = React.useMemo(
		() => new Set(leftColumns.map((c) => c.id)),
		[leftColumns],
	);

	const rightColumnIds = React.useMemo(
		() => new Set(rightColumns.map((c) => c.id)),
		[rightColumns],
	);

	/**
	 * Get inline styles for sticky positioning
	 */
	const getStickyStyle = React.useCallback(
		(columnId: string): React.CSSProperties | undefined => {
			const leftPos = leftPositions[columnId];
			if (leftPos !== undefined) {
				return {
					"--sticky-left": `${leftPos}px`,
				} as React.CSSProperties;
			}

			const rightPos = rightPositions[columnId];
			if (rightPos !== undefined) {
				return {
					"--sticky-right": `${rightPos}px`,
				} as React.CSSProperties;
			}

			return undefined;
		},
		[leftPositions, rightPositions],
	);

	/**
	 * Get class names for sticky positioning and visual styling
	 */
	const getStickyClassName = React.useCallback(
		(columnId: string, baseClassName?: string): string => {
			const isLeftSticky = leftColumnIds.has(columnId);
			const isRightSticky = rightColumnIds.has(columnId);

			return cn(
				baseClassName,
				isLeftSticky &&
					"sticky left-[var(--sticky-left)] z-10 bg-background",
				isRightSticky &&
					"sticky right-[var(--sticky-right)] z-10 bg-background",
			);
		},
		[leftColumnIds, rightColumnIds],
	);

	/**
	 * Check if a column is sticky (left or right)
	 */
	const isSticky = React.useCallback(
		(columnId: string): boolean => {
			return leftColumnIds.has(columnId) || rightColumnIds.has(columnId);
		},
		[leftColumnIds, rightColumnIds],
	);

	/**
	 * Check if a column is left-pinned
	 */
	const isLeftPinned = React.useCallback(
		(columnId: string): boolean => {
			return leftColumnIds.has(columnId);
		},
		[leftColumnIds],
	);

	/**
	 * Check if a column is right-pinned
	 */
	const isRightPinned = React.useCallback(
		(columnId: string): boolean => {
			return rightColumnIds.has(columnId);
		},
		[rightColumnIds],
	);

	return {
		getStickyStyle,
		getStickyClassName,
		isSticky,
		isLeftPinned,
		isRightPinned,
		leftPositions,
		rightPositions,
	};
}
