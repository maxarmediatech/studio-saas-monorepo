"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@repo/ui/components/popover";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@repo/ui/components/command";
import { PlusIcon } from "lucide-react";
import type {
	ToolbarFilterConfig,
	ToolbarFilterValues,
} from "./DataTableToolbar";
import { isFilterActive } from "./filter-row-utils";

interface DataTableAddFilterMenuProps {
	filters: ToolbarFilterConfig[];
	filterValues: ToolbarFilterValues;
	onSelectFilter: (filterId: string) => void;
	hideActive?: boolean;
}

export function DataTableAddFilterMenu({
	filters,
	filterValues,
	onSelectFilter,
	hideActive = true,
}: DataTableAddFilterMenuProps) {
	const [open, setOpen] = useState(false);

	const availableFilters = hideActive
		? filters.filter((f) => !isFilterActive(filterValues[f.id], f.variant))
		: filters;

	if (availableFilters.length === 0) {
		return null;
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
				>
					<PlusIcon className="size-3.5" />
					Filter
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-56 p-0" align="start">
				<Command>
					<CommandInput placeholder="Search filters..." />
					<CommandList>
						<CommandEmpty>No filters found.</CommandEmpty>
						<CommandGroup>
							{availableFilters.map((filter) => (
								<CommandItem
									key={filter.id}
									onSelect={() => {
										onSelectFilter(filter.id);
										setOpen(false);
									}}
									className="gap-2"
								>
									{filter.icon && (
										<filter.icon className="size-4 text-muted-foreground" />
									)}
									<span>{filter.label}</span>
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
