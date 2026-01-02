"use client";

import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@repo/ui/components/table";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	type OnChangeFn,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import {
	DataTablePagination,
	type PaginationState,
} from "./DataTablePagination";
import { DataTableSkeleton } from "./DataTableSkeleton";

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
	/** Server-side sorting */
	sorting?: SortingState;
	onSortingChange?: OnChangeFn<SortingState>;
	/** Show row opacity when fetching/pending */
	isFetching?: boolean;
	/** Additional class for table container */
	className?: string;
}

export function DataTable<TData, TValue>({
	columns,
	data,
	isLoading = false,
	skeletonRows = 5,
	emptyState,
	pagination,
	onPaginationChange,
	sorting: externalSorting,
	onSortingChange,
	isFetching = false,
	className,
}: DataTableProps<TData, TValue>) {
	// Internal sorting state (used when no external sorting provided)
	const [internalSorting, setInternalSorting] = useState<SortingState>([]);

	const sorting = externalSorting ?? internalSorting;
	const setSorting = onSortingChange ?? setInternalSorting;

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		onSortingChange: setSorting,
		state: {
			sorting,
		},
		manualSorting: !!onSortingChange,
		manualPagination: !!pagination,
	});

	const showLoading = isLoading && data.length === 0;

	return (
		<div className={className}>
			<div className="rounded-md border">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<TableHead key={header.id}>
										{header.isPlaceholder
											? null
											: flexRender(
													header.column.columnDef
														.header,
													header.getContext(),
												)}
									</TableHead>
								))}
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
									className={isFetching ? "opacity-50" : ""}
								>
									{row.getVisibleCells().map((cell) => (
										<TableCell key={cell.id}>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext(),
											)}
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell
									colSpan={columns.length}
									className="h-32 text-center"
								>
									{emptyState ?? (
										<p className="text-muted-foreground">
											No results.
										</p>
									)}
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			{pagination && pagination.pageCount > 1 && (
				<DataTablePagination
					pagination={pagination}
					onPaginationChange={onPaginationChange}
					isLoading={isFetching}
				/>
			)}
		</div>
	);
}
