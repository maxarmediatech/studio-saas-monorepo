"use client";

import { Input } from "@repo/ui/components/input";
import {
	Popover,
	PopoverAnchor,
	PopoverContent,
} from "@repo/ui/components/popover";
import { cn } from "@repo/ui/lib/utils";
import { CheckIcon } from "lucide-react";
import * as React from "react";

export interface AutocompleteSuggestion {
	/** The value to set when selected */
	value: string;
	/** Display label for the suggestion */
	label: string;
}

export interface AutocompleteInputProps {
	/** Current input value */
	value: string;
	/** Callback when value changes */
	onChange: (value: string) => void;
	/** Suggestions to show in dropdown */
	suggestions: AutocompleteSuggestion[];
	/** Placeholder text */
	placeholder?: string;
	/** ID for form association */
	id?: string;
	/** Whether the input is disabled */
	disabled?: boolean;
	/** aria-invalid for form validation */
	"aria-invalid"?: boolean;
	/** Additional class name */
	className?: string;
}

/**
 * AutocompleteInput - An input field with dropdown suggestions.
 *
 * Unlike Combobox, this allows free-text input while also providing suggestions.
 * Users can type anything or select from filtered suggestions.
 */
function AutocompleteInput({
	value,
	onChange,
	suggestions,
	placeholder = "Type or select...",
	id,
	disabled = false,
	"aria-invalid": ariaInvalid,
	className,
}: AutocompleteInputProps) {
	const [open, setOpen] = React.useState(false);
	const inputRef = React.useRef<HTMLInputElement>(null);

	// Filter suggestions based on input value
	const filteredSuggestions = React.useMemo(() => {
		if (!value.trim()) {
			return suggestions;
		}
		const searchTerm = value.toLowerCase();
		return suggestions.filter(
			(s) =>
				s.label.toLowerCase().includes(searchTerm) ||
				s.value.toLowerCase().includes(searchTerm),
		);
	}, [value, suggestions]);

	// Check if current value matches a suggestion exactly
	const exactMatch = React.useMemo(() => {
		return suggestions.find(
			(s) =>
				s.value.toLowerCase() === value.toLowerCase() ||
				s.label.toLowerCase() === value.toLowerCase(),
		);
	}, [value, suggestions]);

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		onChange(e.target.value);
		if (!open) {
			setOpen(true);
		}
	};

	const handleSelect = (suggestion: AutocompleteSuggestion) => {
		onChange(suggestion.label);
		setOpen(false);
		inputRef.current?.focus();
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Escape") {
			setOpen(false);
		} else if (e.key === "ArrowDown" && !open) {
			setOpen(true);
		}
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverAnchor asChild>
				<Input
					ref={inputRef}
					id={id}
					type="text"
					value={value}
					onChange={handleInputChange}
					onFocus={() => setOpen(true)}
					onKeyDown={handleKeyDown}
					placeholder={placeholder}
					disabled={disabled}
					aria-invalid={ariaInvalid}
					aria-autocomplete="list"
					aria-expanded={open}
					autoComplete="off"
					className={className}
				/>
			</PopoverAnchor>
			<PopoverContent
				className="w-[--radix-popover-trigger-width] p-0"
				align="start"
				onOpenAutoFocus={(e) => e.preventDefault()}
				onInteractOutside={(e) => {
					// Don't close if clicking on the input
					if (e.target === inputRef.current) {
						e.preventDefault();
					}
				}}
			>
				{filteredSuggestions.length === 0 ? (
					<div className="py-3 px-4 text-sm text-muted-foreground text-center">
						No suggestions. Type to enter custom value.
					</div>
				) : (
					<div className="max-h-[200px] overflow-y-auto py-1">
						{filteredSuggestions.map((suggestion) => {
							const isSelected =
								exactMatch?.value === suggestion.value;
							return (
								<button
									key={suggestion.value}
									type="button"
									onClick={() => handleSelect(suggestion)}
									className={cn(
										"flex w-full items-center gap-2 px-3 py-2 text-sm text-left",
										"hover:bg-accent hover:text-accent-foreground",
										"focus:bg-accent focus:text-accent-foreground focus:outline-none",
										isSelected && "bg-accent/50",
									)}
								>
									<CheckIcon
										className={cn(
											"size-4 shrink-0",
											isSelected
												? "opacity-100"
												: "opacity-0",
										)}
									/>
									<span>{suggestion.label}</span>
								</button>
							);
						})}
					</div>
				)}
			</PopoverContent>
		</Popover>
	);
}

export { AutocompleteInput };
