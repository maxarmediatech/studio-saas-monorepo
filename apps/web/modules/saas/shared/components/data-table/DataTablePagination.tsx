"use client";

import { Button } from "@repo/ui/components/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import {
	ChevronLeftIcon,
	ChevronRightIcon,
	ChevronsLeftIcon,
	ChevronsRightIcon,
	Loader2Icon,
} from "lucide-react";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50] as const;

export interface PaginationState {
	page: number;
	limit: number;
	total: number;
	pageCount: number;
}

interface DataTablePaginationProps {
	pagination: PaginationState;
	onPaginationChange?: (pagination: PaginationState) => void;
	onLimitChange?: (limit: number) => void;
	isLoading?: boolean;
}

export function DataTablePagination({
	pagination,
	onPaginationChange,
	onLimitChange,
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
			{/* Left: Results info */}
			<p className="text-sm text-muted-foreground">
				Showing {startItem} to {endItem} of {total} results
			</p>

			{/* Right: Rows per page + Page indicator + Navigation */}
			<div className="flex items-center gap-6">
				{/* Rows per page selector */}
				{onLimitChange && (
					<div className="flex items-center gap-2">
						<span className="text-sm text-muted-foreground">Rows per page</span>
						<Select
							value={`${limit}`}
							onValueChange={(value) => onLimitChange(Number(value))}
						>
							<SelectTrigger className="h-8 w-[70px]" size="sm">
								<SelectValue placeholder={limit} />
							</SelectTrigger>
							<SelectContent side="top">
								{PAGE_SIZE_OPTIONS.map((pageSize) => (
									<SelectItem key={pageSize} value={`${pageSize}`}>
										{pageSize}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				)}

				{/* Page indicator */}
				<span className="text-sm text-muted-foreground">
					Page {page} of {pageCount}
				</span>

				{/* Navigation buttons */}
				<div className="flex items-center gap-1">
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
		</div>
	);
}
