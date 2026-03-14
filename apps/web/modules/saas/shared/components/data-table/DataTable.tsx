"use client";

import {
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@repo/ui/components/table";
import { useIsMobile } from "@repo/ui/hooks/use-mobile";
import { cn } from "@repo/ui/lib/utils";
import { useTableScroll } from "@saas/shared/hooks/use-table-scroll";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	type OnChangeFn,
	type RowSelectionState,
	type SortingState,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import * as React from "react";
import { useState } from "react";
import { DataTableHorizontalScroll } from "./DataTableHorizontalScroll";
import {
	DataTablePagination,
	type PaginationState,
} from "./DataTablePagination";
import { DataTableSkeleton } from "./DataTableSkeleton";

export interface StickyColumnConfig {
	/** Column ID */
	id: string;
	/** Width of the column in pixels */
	width: number;
}

export interface DataTableProps<TData, TValue> {
	columns: ColumnDef<TData, TValue>[];
	data: TData[];
	isLoading?: boolean;
	/** Number of skeleton rows to show when loading */
	skeletonRows?: number;
	/** Empty state content */
	emptyState?: React.ReactNode;
	/** Server-side pagination */
	pagination?: PaginationState;
	onPaginationChange?: (pagination: PaginationState) => void;
	onLimitChange?: (limit: number) => void;
	/** Server-side sorting */
	sorting?: SortingState;
	onSortingChange?: OnChangeFn<SortingState>;
	/** Row selection state */
	rowSelection?: RowSelectionState;
	onRowSelectionChange?: OnChangeFn<RowSelectionState>;
	/** Enable row selection */
	enableRowSelection?: boolean;
	/** Show row opacity when fetching/pending */
	isFetching?: boolean;
	/** Additional class for table container */
	className?: string;
	/** Custom row ID getter */
	getRowId?: (row: TData) => string;
	/** Configuration for left-pinned columns */
	stickyLeftColumns?: StickyColumnConfig[];
	/** Configuration for right-pinned columns */
	stickyRightColumns?: StickyColumnConfig[];
	/** Minimum table width (for horizontal scroll) */
	minWidth?: number;
	/** Column ID where horizontal scroll controls should appear */
	scrollControlsColumnId?: string;
	/** Column index to start scrolling from (columns before this are sticky) */
	scrollStartColumn?: number;
	/** Controlled column visibility state */
	columnVisibility?: VisibilityState;
	/** Handler for column visibility changes (controlled mode) */
	onColumnVisibilityChange?: OnChangeFn<VisibilityState>;
}

interface ColumnMeta {
	width?: number;
	minWidth?: number;
	maxWidth?: number;
	headerClassName?: string;
	cellClassName?: string;
}

export function DataTable<TData, TValue>({
	columns,
	data,
	isLoading = false,
	skeletonRows = 5,
	emptyState,
	pagination,
	onPaginationChange,
	onLimitChange,
	sorting: externalSorting,
	onSortingChange,
	rowSelection: externalRowSelection,
	onRowSelectionChange,
	enableRowSelection = false,
	isFetching = false,
	className,
	getRowId,
	stickyLeftColumns = [],
	stickyRightColumns = [],
	minWidth,
	scrollControlsColumnId,
	scrollStartColumn,
	columnVisibility: externalColumnVisibility,
	onColumnVisibilityChange,
}: DataTableProps<TData, TValue>) {
	const isMobile = useIsMobile();

	// Internal sorting state (used when no external sorting provided)
	const [internalSorting, setInternalSorting] = useState<SortingState>([]);
	// Internal row selection state (used when no external selection provided)
	const [internalRowSelection, setInternalRowSelection] =
		useState<RowSelectionState>({});
	// Internal column visibility state (used when no external visibility provided)
	const [internalColumnVisibility, setInternalColumnVisibility] =
		useState<VisibilityState>({});

	const sorting = externalSorting ?? internalSorting;
	const setSorting = onSortingChange ?? setInternalSorting;

	const rowSelection = externalRowSelection ?? internalRowSelection;
	const setRowSelection = onRowSelectionChange ?? setInternalRowSelection;

	const columnVisibility =
		externalColumnVisibility ?? internalColumnVisibility;
	const setColumnVisibility =
		onColumnVisibilityChange ?? setInternalColumnVisibility;

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		onSortingChange: setSorting,
		onRowSelectionChange: setRowSelection,
		onColumnVisibilityChange: setColumnVisibility,
		getRowId,
		state: {
			sorting,
			rowSelection,
			columnVisibility,
		},
		// Only enable manual sorting when external sorting is provided (server-side sorting).
		// Otherwise, allow TanStack Table to sort client-side using getSortedRowModel.
		manualSorting: Boolean(externalSorting),
		manualPagination: !!pagination,
		// Enable multi-sort only if explicitly needed
		enableMultiSort: false,
		enableRowSelection,
	});

	const showLoading = isLoading && data.length === 0;

	const effectiveStickyLeftColumns = isMobile ? [] : stickyLeftColumns;
	const effectiveStickyRightColumns = isMobile ? [] : stickyRightColumns;

	// Set up horizontal scroll controls
	const hasSticky =
		effectiveStickyLeftColumns.length > 0 ||
		effectiveStickyRightColumns.length > 0;
	const defaultStartColumn = hasSticky
		? effectiveStickyLeftColumns.length
		: 0;
	const tableScroll = useTableScroll({
		useColumnWidths: true,
		startFromColumn: scrollStartColumn ?? defaultStartColumn,
		enableStickyShadows: hasSticky,
	});

	// Build sticky position maps
	const leftColumnIds = React.useMemo(
		() => new Set(effectiveStickyLeftColumns.map((c) => c.id)),
		[effectiveStickyLeftColumns],
	);

	const rightColumnIds = React.useMemo(
		() => new Set(effectiveStickyRightColumns.map((c) => c.id)),
		[effectiveStickyRightColumns],
	);

	// Calculate left positions for left-pinned columns
	const leftPositions = React.useMemo(() => {
		let position = 0;
		const positions: Record<string, number> = {};

		for (const col of effectiveStickyLeftColumns) {
			positions[col.id] = position;
			position += col.width;
		}

		return positions;
	}, [effectiveStickyLeftColumns]);

	// Calculate right positions for right-pinned columns
	const rightPositions = React.useMemo(() => {
		let position = 0;
		const positions: Record<string, number> = {};

		// Process from right to left
		for (let i = effectiveStickyRightColumns.length - 1; i >= 0; i--) {
			const col = effectiveStickyRightColumns[i];
			if (col) {
				positions[col.id] = position;
				position += col.width;
			}
		}

		return positions;
	}, [effectiveStickyRightColumns]);

	const getStickyStyle = React.useCallback(
		(
			columnId: string,
			meta?: ColumnMeta,
			isHeader = false,
		): React.CSSProperties => {
			const style: React.CSSProperties = {};

			if (meta?.width !== undefined) {
				style.width = `${meta.width}px`;
			}
			if (meta?.minWidth !== undefined) {
				style.minWidth = `${meta.minWidth}px`;
			}
			if (meta?.maxWidth !== undefined) {
				style.maxWidth = `${meta.maxWidth}px`;
			}

			const leftPos = leftPositions[columnId];
			if (leftPos !== undefined) {
				style.left = `${leftPos}px`;
				style.position = "sticky";
				style.zIndex = isHeader ? 15 : 10;
			}

			const rightPos = rightPositions[columnId];
			if (rightPos !== undefined) {
				style.right = `${rightPos}px`;
				style.position = "sticky";
				style.zIndex = isHeader ? 15 : 10;
			}

			return style;
		},
		[leftPositions, rightPositions],
	);

	const rightStickyDividerTargetId = React.useMemo(() => {
		if (effectiveStickyRightColumns.length === 0) {
			return null;
		}

		const visibleLeafColumnIds = table
			.getVisibleLeafColumns()
			.map((c) => c.id);

		for (const stickyColumn of effectiveStickyRightColumns) {
			const stickyId = stickyColumn.id;
			const idx = visibleLeafColumnIds.indexOf(stickyId);
			if (idx > 0) {
				return visibleLeafColumnIds[idx - 1] ?? null;
			}
		}

		return null;
	}, [table, effectiveStickyRightColumns]);

	const getStickyClassName = React.useCallback(
		(columnId: string, isHeader: boolean, meta?: ColumnMeta): string => {
			const isLeftSticky = leftColumnIds.has(columnId);
			const isRightSticky = rightColumnIds.has(columnId);
			const isSticky = isLeftSticky || isRightSticky;
			const baseMetaClass = isHeader
				? meta?.headerClassName
				: meta?.cellClassName;

			const rightIndex = effectiveStickyRightColumns.findIndex(
				(c) => c.id === columnId,
			);
			const isFirstRightSticky = rightIndex === 0;

			return cn(
				baseMetaClass,
				rightStickyDividerTargetId === columnId && "!border-r-0",
				isSticky &&
					!isHeader &&
					"bg-table-surface group-hover:bg-table-row-selected group-data-[state=selected]:bg-table-row-selected group-data-[state=selected]:hover:bg-table-row-selected-hover",
				isFirstRightSticky &&
					"before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[0.5px] before:bg-table-border-subtle",
			);
		},
		[
			leftColumnIds,
			rightColumnIds,
			effectiveStickyRightColumns,
			rightStickyDividerTargetId,
		],
	);

	return (
		<div className={className}>
			<div
				ref={tableScroll.containerRef}
				className={cn(
					"border-table-border-subtle bg-card overflow-x-auto overflow-y-visible rounded-lg border [touch-action:pan-x_pan-y]",
					hasSticky &&
						"vertical-scrollbar horizontal-scrollbar scrollbar-md overscroll-x-none",
				)}
			>
				<table
					className={cn(
						"w-full caption-bottom text-[0.8125rem]",
						hasSticky && "relative",
					)}
					style={minWidth ? { minWidth: `${minWidth}px` } : undefined}
				>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow
								key={headerGroup.id}
								className="hover:bg-transparent"
							>
								{headerGroup.headers.map((header) => {
									const meta = header.column.columnDef.meta as
										| ColumnMeta
										| undefined;
									const stickyStyle = getStickyStyle(
										header.column.id,
										meta,
										true,
									);
									const stickyClass = getStickyClassName(
										header.column.id,
										true,
										meta,
									);

									// Check if this column should display scroll controls
									// Only show when table is actually scrollable
									const showScrollControls =
										scrollControlsColumnId &&
										header.column.id ===
											scrollControlsColumnId &&
										tableScroll.isScrollable;

									return (
										<TableHead
											key={header.id}
											className={cn(
												"relative",
												stickyClass,
											)}
											style={stickyStyle}
										>
											{header.isPlaceholder ? null : showScrollControls ? (
												<div className="flex items-center justify-between gap-2">
													{flexRender(
														header.column.columnDef
															.header,
														header.getContext(),
													)}
													<DataTableHorizontalScroll
														canScrollLeft={
															tableScroll.canScrollLeft
														}
														canScrollRight={
															tableScroll.canScrollRight
														}
														onScrollLeft={() =>
															tableScroll.scrollLeft()
														}
														onScrollRight={() =>
															tableScroll.scrollRight()
														}
														className="hidden md:flex"
													/>
												</div>
											) : (
												flexRender(
													header.column.columnDef
														.header,
													header.getContext(),
												)
											)}
										</TableHead>
									);
								})}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{showLoading ? (
							<DataTableSkeleton
								columns={columns.length}
								rows={skeletonRows}
							/>
						) : table.getRowModel().rows?.length ? (
							table.getRowModel().rows.map((row) => (
								<TableRow
									key={row.id}
									data-state={
										row.getIsSelected() && "selected"
									}
									className={cn(
										"last:border-b-0",
										isFetching && "opacity-50",
									)}
								>
									{row.getVisibleCells().map((cell) => {
										const meta = cell.column.columnDef
											.meta as ColumnMeta | undefined;

										const stickyStyle = getStickyStyle(
											cell.column.id,
											meta,
										);
										const stickyClass = getStickyClassName(
											cell.column.id,
											false,
											meta,
										);

										return (
											<TableCell
												key={cell.id}
												className={cn(
													"relative",
													stickyClass,
												)}
												style={stickyStyle}
											>
												{flexRender(
													cell.column.columnDef.cell,
													cell.getContext(),
												)}
											</TableCell>
										);
									})}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell
									colSpan={columns.length}
									className="text-muted-foreground h-24 text-center"
								>
									{emptyState ?? "No results."}
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</table>
			</div>

			{pagination && (
				<DataTablePagination
					pagination={pagination}
					onPaginationChange={onPaginationChange}
					onLimitChange={onLimitChange}
					isLoading={isFetching}
				/>
			)}
		</div>
	);
}
