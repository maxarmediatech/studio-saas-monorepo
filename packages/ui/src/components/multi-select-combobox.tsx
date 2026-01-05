"use client";

import { Badge } from "@repo/ui/components/badge";
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
import { CheckIcon, ChevronsUpDownIcon, XIcon } from "lucide-react";
import * as React from "react";

export interface MultiSelectOption {
	value: string;
	label: string;
	disabled?: boolean;
}

export interface MultiSelectComboboxProps<T extends MultiSelectOption> {
	/** Available options */
	options: T[];
	/** Currently selected values */
	value: string[];
	/** Callback when values change */
	onValueChange: (value: string[]) => void;
	/** Placeholder text when no value selected */
	placeholder?: string;
	/** Placeholder text for search input */
	searchPlaceholder?: string;
	/** Text to show when no options match search */
	emptyText?: string;
	/** Whether the combobox is disabled */
	disabled?: boolean;
	/** Custom render function for dropdown items */
	renderOption?: (option: T, isSelected: boolean) => React.ReactNode;
	/** Custom render function for selected chips (return null to use default) */
	renderSelectedItem?: (
		option: T,
		onRemove: () => void,
	) => React.ReactNode;
	/** Additional class name for trigger button */
	className?: string;
	/** ID for form association */
	id?: string;
	/** aria-invalid for form validation */
	"aria-invalid"?: boolean;
}

function MultiSelectCombobox<T extends MultiSelectOption>({
	options,
	value,
	onValueChange,
	placeholder = "Select...",
	searchPlaceholder = "Search...",
	emptyText = "No results found.",
	disabled = false,
	renderOption,
	renderSelectedItem,
	className,
	id,
	"aria-invalid": ariaInvalid,
}: MultiSelectComboboxProps<T>) {
	const [open, setOpen] = React.useState(false);

	const selectedOptions = React.useMemo(
		() => options.filter((option) => value.includes(option.value)),
		[options, value],
	);

	const handleSelect = (optionValue: string) => {
		if (value.includes(optionValue)) {
			// Remove if already selected
			onValueChange(value.filter((v) => v !== optionValue));
		} else {
			// Add to selection
			onValueChange([...value, optionValue]);
		}
	};

	const handleRemove = (optionValue: string) => {
		onValueChange(value.filter((v) => v !== optionValue));
	};

	const defaultRenderSelectedItem = (option: T, onRemove: () => void) => (
		<Badge
			variant="secondary"
			className="flex items-center gap-1 pr-1"
		>
			<span className="truncate">{option.label}</span>
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					onRemove();
				}}
				className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
			>
				<XIcon className="size-3" />
				<span className="sr-only">Remove {option.label}</span>
			</button>
		</Badge>
	);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				{/* Using div instead of Button to allow nested button elements (remove chips) */}
				<div
					id={id}
					role="combobox"
					aria-expanded={open}
					aria-invalid={ariaInvalid}
					aria-disabled={disabled}
					tabIndex={disabled ? -1 : 0}
					onKeyDown={(e) => {
						// Open on Enter/Space like a button
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							if (!disabled) setOpen(true);
						}
					}}
					className={cn(
						// Base button-like styling (matches Button variant="outline")
						"flex w-full min-h-9 h-auto items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs",
						"ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
						// Hover/disabled states
						disabled
							? "cursor-not-allowed opacity-50"
							: "cursor-pointer hover:bg-accent hover:text-accent-foreground",
						// Text styling
						!value.length && "text-muted-foreground",
						className,
					)}
				>
					<div className="flex flex-wrap gap-1 flex-1">
						{selectedOptions.length > 0 ? (
							selectedOptions.map((option) =>
								renderSelectedItem ? (
									<React.Fragment key={option.value}>
										{renderSelectedItem(option, () =>
											handleRemove(option.value),
										)}
									</React.Fragment>
								) : (
									<React.Fragment key={option.value}>
										{defaultRenderSelectedItem(option, () =>
											handleRemove(option.value),
										)}
									</React.Fragment>
								),
							)
						) : (
							<span>{placeholder}</span>
						)}
					</div>
					<ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
				</div>
			</PopoverTrigger>
			<PopoverContent
				className="w-[--radix-popover-trigger-width] p-0"
				align="start"
			>
				<Command>
					<CommandInput placeholder={searchPlaceholder} />
					<CommandList>
						<CommandEmpty>{emptyText}</CommandEmpty>
						<CommandGroup>
							{options.map((option) => {
								const isSelected = value.includes(option.value);
								return (
									<CommandItem
										key={option.value}
										value={option.value}
										disabled={option.disabled}
										onSelect={() => handleSelect(option.value)}
										keywords={[option.label]}
									>
										<div
											className={cn(
												"mr-2 flex size-4 items-center justify-center rounded-sm border border-primary",
												isSelected
													? "bg-primary text-primary-foreground"
													: "opacity-50 [&_svg]:invisible",
											)}
										>
											<CheckIcon className="size-3" />
										</div>
										{renderOption ? (
											renderOption(option, isSelected)
										) : (
											<span>{option.label}</span>
										)}
									</CommandItem>
								);
							})}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

export { MultiSelectCombobox };
