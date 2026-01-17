"use client";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { cn } from "@repo/ui/lib/utils";
import type { Column } from "@tanstack/react-table";
import {
	ArrowDownWideNarrow,
	ArrowUpNarrowWide,
	ChevronDown,
	EyeOff,
	X,
} from "lucide-react";
import { useSortContext } from "./DataTableSortContext";

interface DataTableColumnHeaderProps<TData, TValue>
	extends React.HTMLAttributes<HTMLDivElement> {
	column: Column<TData, TValue>;
	title: string;
	icon?: React.ReactNode;
	simple?: boolean;
}

export function DataTableColumnHeader<TData, TValue>({
	column,
	title,
	icon,
	simple = false,
	className,
}: DataTableColumnHeaderProps<TData, TValue>) {
	const sortContext = useSortContext();

	if (!column.getCanSort()) {
		return (
			<div
				className={cn(
					"flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground",
					className,
				)}
			>
				{icon && (
					<span className="h-4 w-4 text-muted-foreground/60">
						{icon}
					</span>
				)}
				<span>{title}</span>
			</div>
		);
	}

	const columnId = column.id;
	let currentDirection: "asc" | "desc" | false;

	if (sortContext) {
		currentDirection =
			sortContext.sortColumn === columnId
				? sortContext.sortDirection
				: false;
	} else {
		currentDirection = column.getIsSorted();
	}

	const isSorted = currentDirection !== false;

	if (simple) {
		return (
			<button
				type="button"
				className={cn(
					"flex w-full items-center justify-between gap-1.5",
					"py-2 text-[0.8125rem]",
					"text-muted-foreground hover:text-foreground",
					"cursor-pointer outline-none transition-colors",
					className,
				)}
				onClick={() => column.toggleSorting(currentDirection === "asc")}
			>
				<div className="flex items-center gap-1.5">
					{icon && (
						<span className="h-4 w-4 text-muted-foreground/60">
							{icon}
						</span>
					)}
					<span>{title}</span>
				</div>
				<div className="ml-2 flex items-center">
					{isSorted && (
						<span className="flex h-3.5 w-3.5 items-center justify-center">
							{currentDirection === "asc" ? (
								<ArrowDownWideNarrow className="h-3 w-3" />
							) : (
								<ArrowUpNarrowWide className="h-3 w-3" />
							)}
						</span>
					)}
					<ChevronDown className="h-3 w-3" aria-hidden="true" />
				</div>
			</button>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className={cn(
						"flex w-full items-center justify-between gap-1.5",
						"py-2 text-[0.8125rem]",
						"text-muted-foreground hover:text-foreground",
						"cursor-pointer outline-none transition-colors",
						"data-[state=open]:text-foreground",
						className,
					)}
				>
					<div className="flex items-center gap-1.5">
						{icon && (
							<span className="h-4 w-4 text-muted-foreground/60">
								{icon}
							</span>
						)}
						<span>{title}</span>
					</div>
					<div className="ml-2 flex items-center">
						{isSorted && (
							<span className="flex h-3.5 w-3.5 items-center justify-center">
								{currentDirection === "asc" ? (
									<ArrowDownWideNarrow className="h-3 w-3" />
								) : (
									<ArrowUpNarrowWide className="h-3 w-3" />
								)}
							</span>
						)}
						<ChevronDown className="h-3 w-3" aria-hidden="true" />
					</div>
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="min-w-[160px]">
				<DropdownMenuItem
					onClick={() => column.toggleSorting(false)}
					className={cn(
						"flex items-center gap-2 text-[0.8125rem]",
						currentDirection === "asc" && "text-foreground",
					)}
				>
					<ArrowDownWideNarrow className="h-3.5 w-3.5 stroke-[1.5]" />
					<span>Sort Ascending</span>
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={() => column.toggleSorting(true)}
					className={cn(
						"flex items-center gap-2 text-[0.8125rem]",
						currentDirection === "desc" && "text-foreground",
					)}
				>
					<ArrowUpNarrowWide className="h-3.5 w-3.5 stroke-[1.5]" />
					<span>Sort Descending</span>
				</DropdownMenuItem>
				{isSorted && (
					<DropdownMenuItem
						onClick={() => column.clearSorting()}
						className="flex items-center gap-2 text-[0.8125rem]"
					>
						<X className="h-3.5 w-3.5 stroke-[1.5]" />
						<span>Clear Sorting</span>
					</DropdownMenuItem>
				)}
				{column.getCanHide() && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onClick={() => column.toggleVisibility(false)}
							className="flex items-center gap-2 text-[0.8125rem]"
						>
							<EyeOff className="h-3.5 w-3.5 stroke-[1.5]" />
							<span>Hide Column</span>
						</DropdownMenuItem>
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
