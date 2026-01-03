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
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@repo/ui/components/form";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@repo/ui/components/popover";
import { cn } from "@repo/ui/lib/utils";
import { CheckIcon, ChevronsUpDownIcon, Loader2Icon } from "lucide-react";
import { useState } from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";

export interface ComboboxOption {
	value: string;
	label: string;
	description?: string;
}

interface FormComboboxFieldProps<
	TFieldValues extends FieldValues,
	TName extends FieldPath<TFieldValues>,
> {
	control: Control<TFieldValues>;
	name: TName;
	label: string;
	options: ComboboxOption[];
	placeholder?: string;
	searchPlaceholder?: string;
	emptyText?: string;
	description?: string;
	disabled?: boolean;
	isLoading?: boolean;
	className?: string;
	onSearchChange?: (search: string) => void;
}

export function FormComboboxField<
	TFieldValues extends FieldValues,
	TName extends FieldPath<TFieldValues>,
>({
	control,
	name,
	label,
	options,
	placeholder = "Select...",
	searchPlaceholder = "Search...",
	emptyText = "No results found.",
	description,
	disabled,
	isLoading,
	className,
	onSearchChange,
}: FormComboboxFieldProps<TFieldValues, TName>) {
	const [open, setOpen] = useState(false);

	return (
		<FormField
			control={control}
			name={name}
			render={({ field }) => (
				<FormItem className={cn("flex flex-col", className)}>
					<FormLabel>{label}</FormLabel>
					<Popover open={open} onOpenChange={setOpen}>
						<PopoverTrigger asChild>
							<FormControl>
								<Button
									variant="outline"
									role="combobox"
									aria-expanded={open}
									disabled={disabled}
									className={cn(
										"w-full justify-between font-normal",
										!field.value && "text-muted-foreground",
									)}
								>
									{field.value
										? options.find(
												(option) =>
													option.value ===
													field.value,
											)?.label
										: placeholder}
									{isLoading ? (
										<Loader2Icon className="ml-2 h-4 w-4 shrink-0 animate-spin" />
									) : (
										<ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
									)}
								</Button>
							</FormControl>
						</PopoverTrigger>
						<PopoverContent className="w-full p-0" align="start">
							<Command>
								<CommandInput
									placeholder={searchPlaceholder}
									onValueChange={onSearchChange}
								/>
								<CommandList>
									<CommandEmpty>{emptyText}</CommandEmpty>
									<CommandGroup>
										{options.map((option) => (
											<CommandItem
												key={option.value}
												value={option.label}
												onSelect={() => {
													field.onChange(
														option.value,
													);
													setOpen(false);
												}}
											>
												<CheckIcon
													className={cn(
														"mr-2 h-4 w-4",
														field.value ===
															option.value
															? "opacity-100"
															: "opacity-0",
													)}
												/>
												<div className="flex flex-col">
													<span>{option.label}</span>
													{option.description && (
														<span className="text-xs text-muted-foreground">
															{option.description}
														</span>
													)}
												</div>
											</CommandItem>
										))}
									</CommandGroup>
								</CommandList>
							</Command>
						</PopoverContent>
					</Popover>
					{description && (
						<FormDescription>{description}</FormDescription>
					)}
					<FormMessage />
				</FormItem>
			)}
		/>
	);
}
