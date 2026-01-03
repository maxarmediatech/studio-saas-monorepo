"use client";

import { Button } from "@repo/ui/components/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@repo/ui/components/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@repo/ui/components/popover";
import { cn } from "@repo/ui/lib/utils";
import type { Table } from "@tanstack/react-table";
import { CheckIcon, Settings2Icon } from "lucide-react";
import * as React from "react";

interface DataTableViewOptionsProps<TData> {
	table: Table<TData>;
}

export function DataTableViewOptions<TData>({
	table,
}: DataTableViewOptionsProps<TData>) {
	const columns = React.useMemo(
		() =>
			table
				.getAllColumns()
				.filter(
					(column) =>
						typeof column.accessorFn !== "undefined" &&
						column.getCanHide(),
				),
		[table],
	);

	if (columns.length === 0) {
		return null;
	}

	return (
		<div className="flex items-center justify-center">
			<Popover>
				<PopoverTrigger asChild>
					<Button
						aria-label="Toggle columns"
						variant="ghost"
						size="icon"
						className="h-8 w-8"
					>
						<Settings2Icon className="h-4 w-4" />
					</Button>
				</PopoverTrigger>
				<PopoverContent align="end" className="w-44 p-0">
					<Command>
						<CommandInput placeholder="Search columns..." />
						<CommandList>
							<CommandEmpty>No columns found.</CommandEmpty>
							<CommandGroup>
								{columns.map((column) => (
									<CommandItem
										key={column.id}
										onSelect={() =>
											column.toggleVisibility(
												!column.getIsVisible(),
											)
										}
									>
										<span className="truncate">
											{column.columnDef.meta?.label ??
												column.id}
										</span>
										<CheckIcon
											className={cn(
												"ml-auto h-4 w-4 shrink-0",
												column.getIsVisible()
													? "opacity-100"
													: "opacity-0",
											)}
										/>
									</CommandItem>
								))}
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
		</div>
	);
}
