"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@repo/ui/components/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@repo/ui/components/popover";
import { Separator } from "@repo/ui/components/separator";
import { cn } from "@repo/ui/lib/utils";
import { CheckIcon, PlusCircleIcon, XCircleIcon } from "lucide-react";
import * as React from "react";
import type { FilterOption } from "./types";

interface DataTableFacetedFilterProps {
	/** Filter title displayed on the button */
	title: string;
	/** Available options for the filter */
	options: FilterOption[];
	/** Currently selected values */
	selectedValues: string[];
	/** Callback when selection changes */
	onSelectionChange: (values: string[]) => void;
	/** Whether to allow multiple selections */
	multiple?: boolean;
	/** Icon to display in the button */
	icon?: React.ComponentType<{ className?: string }>;
}

export function DataTableFacetedFilter({
	title,
	options,
	selectedValues,
	onSelectionChange,
	multiple = true,
	icon: Icon,
}: DataTableFacetedFilterProps) {
	const [open, setOpen] = React.useState(false);

	const selectedSet = React.useMemo(
		() => new Set(selectedValues),
		[selectedValues],
	);

	const onItemSelect = React.useCallback(
		(option: FilterOption, isSelected: boolean) => {
			if (multiple) {
				const newSelectedValues = new Set(selectedSet);
				if (isSelected) {
					newSelectedValues.delete(option.value);
				} else {
					newSelectedValues.add(option.value);
				}
				onSelectionChange(Array.from(newSelectedValues));
			} else {
				onSelectionChange(isSelected ? [] : [option.value]);
				setOpen(false);
			}
		},
		[multiple, selectedSet, onSelectionChange],
	);

	const onReset = React.useCallback(
		(event?: React.MouseEvent) => {
			event?.stopPropagation();
			onSelectionChange([]);
		},
		[onSelectionChange],
	);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className="h-8 border-dashed"
				>
					{selectedSet.size > 0 ? (
						// biome-ignore lint/a11y/useSemanticElements: Cannot nest button inside PopoverTrigger button
						<span
							role="button"
							tabIndex={0}
							aria-label={`Clear ${title} filter`}
							onClick={onReset}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									onReset();
								}
							}}
							className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
						>
							<XCircleIcon className="h-4 w-4" />
						</span>
					) : Icon ? (
						<Icon className="mr-2 h-4 w-4" />
					) : (
						<PlusCircleIcon className="mr-2 h-4 w-4" />
					)}
					{title}
					{selectedSet.size > 0 && (
						<>
							<Separator
								orientation="vertical"
								className="mx-2 h-4"
							/>
							<Badge
								variant="secondary"
								className="rounded-sm px-1 font-normal lg:hidden"
							>
								{selectedSet.size}
							</Badge>
							<div className="hidden items-center gap-1 lg:flex">
								{selectedSet.size > 2 ? (
									<Badge
										variant="secondary"
										className="rounded-sm px-1 font-normal"
									>
										{selectedSet.size} selected
									</Badge>
								) : (
									options
										.filter((option) =>
											selectedSet.has(option.value),
										)
										.map((option) => (
											<Badge
												variant="secondary"
												key={option.value}
												className="rounded-sm px-1 font-normal"
											>
												{option.label}
											</Badge>
										))
								)}
							</div>
						</>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[200px] p-0" align="start">
				<Command>
					<CommandInput
						placeholder={`Search ${title.toLowerCase()}...`}
					/>
					<CommandList className="max-h-full">
						<CommandEmpty>No results found.</CommandEmpty>
						<CommandGroup className="max-h-[300px] overflow-y-auto overflow-x-hidden">
							{options.map((option) => {
								const isSelected = selectedSet.has(
									option.value,
								);

								return (
									<CommandItem
										key={option.value}
										onSelect={() =>
											onItemSelect(option, isSelected)
										}
									>
										<div
											data-state={
												isSelected
													? "checked"
													: "unchecked"
											}
											className={cn(
												"mr-2 grid size-4 shrink-0 place-content-center rounded-[4px] border border-input text-transparent shadow-xs transition-shadow dark:bg-input/30",
												"data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary",
											)}
										>
											{isSelected ? (
												<CheckIcon className="size-3.5 text-current" />
											) : null}
										</div>
										{option.icon && (
											<option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
										)}
										<span className="truncate">
											{option.label}
										</span>
										{option.count !== undefined && (
											<span className="ml-auto font-mono text-xs text-muted-foreground">
												{option.count}
											</span>
										)}
									</CommandItem>
								);
							})}
						</CommandGroup>
						{selectedSet.size > 0 && (
							<>
								<CommandSeparator />
								<CommandGroup>
									<CommandItem
										onSelect={() => onReset()}
										className="justify-center text-center"
									>
										Clear filters
									</CommandItem>
								</CommandGroup>
							</>
						)}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
