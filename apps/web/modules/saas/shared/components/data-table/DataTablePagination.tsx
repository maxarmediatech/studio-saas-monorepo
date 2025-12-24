"use client";

import { Button } from "@repo/ui/components/button";
import {
	ChevronLeftIcon,
	ChevronRightIcon,
	ChevronsLeftIcon,
	ChevronsRightIcon,
	Loader2Icon,
} from "lucide-react";

export interface PaginationState {
	page: number;
	limit: number;
	total: number;
	pageCount: number;
}

interface DataTablePaginationProps {
	pagination: PaginationState;
	onPaginationChange?: (pagination: PaginationState) => void;
	isLoading?: boolean;
}

export function DataTablePagination({
	pagination,
	onPaginationChange,
	isLoading = false,
}: DataTablePaginationProps) {
	const { page, limit, total, pageCount } = pagination;

	const canGoPrevious = page > 1;
	const canGoNext = page < pageCount;

	const handlePageChange = (newPage: number) => {
		onPaginationChange?.({
			...pagination,
			page: newPage,
		});
	};

	const startItem = (page - 1) * limit + 1;
	const endItem = Math.min(page * limit, total);

	return (
		<div className="flex items-center justify-between px-2 py-4">
			<p className="text-sm text-muted-foreground">
				Showing {startItem} to {endItem} of {total} results
			</p>

			<div className="flex items-center gap-2">
				{/* First page */}
				<Button
					variant="outline"
					size="icon"
					className="h-8 w-8"
					onClick={() => handlePageChange(1)}
					disabled={!canGoPrevious || isLoading}
				>
					<ChevronsLeftIcon className="h-4 w-4" />
					<span className="sr-only">First page</span>
				</Button>

				{/* Previous page */}
				<Button
					variant="outline"
					size="icon"
					className="h-8 w-8"
					onClick={() => handlePageChange(page - 1)}
					disabled={!canGoPrevious || isLoading}
				>
					{isLoading ? (
						<Loader2Icon className="h-4 w-4 animate-spin" />
					) : (
						<ChevronLeftIcon className="h-4 w-4" />
					)}
					<span className="sr-only">Previous page</span>
				</Button>

				{/* Page indicator */}
				<span className="text-sm min-w-[100px] text-center">
					Page {page} of {pageCount}
				</span>

				{/* Next page */}
				<Button
					variant="outline"
					size="icon"
					className="h-8 w-8"
					onClick={() => handlePageChange(page + 1)}
					disabled={!canGoNext || isLoading}
				>
					{isLoading ? (
						<Loader2Icon className="h-4 w-4 animate-spin" />
					) : (
						<ChevronRightIcon className="h-4 w-4" />
					)}
					<span className="sr-only">Next page</span>
				</Button>

				{/* Last page */}
				<Button
					variant="outline"
					size="icon"
					className="h-8 w-8"
					onClick={() => handlePageChange(pageCount)}
					disabled={!canGoNext || isLoading}
				>
					<ChevronsRightIcon className="h-4 w-4" />
					<span className="sr-only">Last page</span>
				</Button>
			</div>
		</div>
	);
}
