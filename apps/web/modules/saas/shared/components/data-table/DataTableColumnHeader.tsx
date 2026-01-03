"use client";

import { Button } from "@repo/ui/components/button";
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
	ArrowDownIcon,
	ArrowUpIcon,
	ChevronsUpDownIcon,
	EyeOffIcon,
} from "lucide-react";
import { useSortContext } from "./DataTableSortContext";

interface DataTableColumnHeaderProps<TData, TValue>
	extends React.HTMLAttributes<HTMLDivElement> {
	column: Column<TData, TValue>;
	title: string;
	/** If true, shows just a clickable header without dropdown */
	simple?: boolean;
}

export function DataTableColumnHeader<TData, TValue>({
	column,
	title,
	simple = false,
	className,
}: DataTableColumnHeaderProps<TData, TValue>) {
	// Try to get sort state from context (URL state)
	const sortContext = useSortContext();

	if (!column.getCanSort()) {
		return <div className={cn(className)}>{title}</div>;
	}

	// Use context (URL state) if available, otherwise fall back to TanStack Table state
	const columnId = column.id;
	let currentDirection: "asc" | "desc" | false;

	if (sortContext) {
		// Context available - use URL state directly
		currentDirection =
			sortContext.sortColumn === columnId
				? sortContext.sortDirection
				: false;
	} else {
		// Fall back to TanStack Table state
		currentDirection = column.getIsSorted();
	}

	if (simple) {
		return (
			<Button
				variant="ghost"
				size="sm"
				className={cn(
					"-ml-3 h-8 data-[state=open]:bg-accent",
					className,
				)}
				onClick={() => column.toggleSorting(currentDirection === "asc")}
			>
				<span>{title}</span>
				{currentDirection === "desc" ? (
					<ArrowDownIcon className="ml-2 h-4 w-4" />
				) : currentDirection === "asc" ? (
					<ArrowUpIcon className="ml-2 h-4 w-4" />
				) : (
					<ChevronsUpDownIcon className="ml-2 h-4 w-4" />
				)}
			</Button>
		);
	}

	return (
		<div className={cn("flex items-center space-x-2", className)}>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						className="-ml-3 h-8 data-[state=open]:bg-accent"
					>
						<span>{title}</span>
						{currentDirection === "desc" ? (
							<ArrowDownIcon className="ml-2 h-4 w-4" />
						) : currentDirection === "asc" ? (
							<ArrowUpIcon className="ml-2 h-4 w-4" />
						) : (
							<ChevronsUpDownIcon className="ml-2 h-4 w-4" />
						)}
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start">
					<DropdownMenuItem
						onClick={() => column.toggleSorting(false)}
					>
						<ArrowUpIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
						Asc
					</DropdownMenuItem>
					<DropdownMenuItem
						onClick={() => column.toggleSorting(true)}
					>
						<ArrowDownIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
						Desc
					</DropdownMenuItem>
					{column.getCanHide() && (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => column.toggleVisibility(false)}
							>
								<EyeOffIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
								Hide
							</DropdownMenuItem>
						</>
					)}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
