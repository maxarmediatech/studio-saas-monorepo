"use client";

import { Button } from "@repo/ui/components/button";
import { Calendar } from "@repo/ui/components/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@repo/ui/components/popover";
import { cn } from "@repo/ui/lib/utils";
import { format, isValid, parse } from "date-fns";
import { CalendarIcon, ChevronDownIcon } from "lucide-react";
import * as React from "react";

export interface DatePickerProps {
	/** ISO date string value (YYYY-MM-DD) */
	value?: string;
	/** Callback when date changes - returns ISO string or empty string */
	onValueChange?: (value: string) => void;
	/** Callback when picker loses focus (for react-hook-form touched state) */
	onBlur?: () => void;
	/** Placeholder text */
	placeholder?: string;
	/** Disabled state */
	disabled?: boolean;
	/** ID for form association */
	id?: string;
	/** aria-invalid for form validation */
	"aria-invalid"?: boolean;
	/** Additional className for trigger button */
	className?: string;
	/** Calendar caption layout - "label" or "dropdown" */
	captionLayout?: "label" | "dropdown";
	/** Minimum selectable date (ISO string) */
	minDate?: string;
	/** Maximum selectable date (ISO string) */
	maxDate?: string;
	/** Days to disable (e.g., weekends) */
	disabledDays?: (date: Date) => boolean;
}

const DatePicker = React.forwardRef<HTMLButtonElement, DatePickerProps>(
	(
		{
			value,
			onValueChange,
			onBlur,
			placeholder = "Select date",
			disabled = false,
			id,
			"aria-invalid": ariaInvalid,
			className,
			captionLayout = "dropdown",
			minDate,
			maxDate,
			disabledDays,
		},
		ref,
	) => {
		const [open, setOpen] = React.useState(false);

		// Call onBlur when popover closes (for react-hook-form touched state)
		const handleOpenChange = React.useCallback(
			(isOpen: boolean) => {
				setOpen(isOpen);
				if (!isOpen) {
					onBlur?.();
				}
			},
			[onBlur],
		);

		// Parse ISO string to Date object
		const selectedDate = React.useMemo(() => {
			if (!value) return undefined;
			const parsed = parse(value, "yyyy-MM-dd", new Date());
			return isValid(parsed) ? parsed : undefined;
		}, [value]);

		// Format date for display
		const displayValue = React.useMemo(() => {
			if (!selectedDate) return placeholder;
			return format(selectedDate, "MMM d, yyyy");
		}, [selectedDate, placeholder]);

		// Handle date selection
		const handleSelect = React.useCallback(
			(date: Date | undefined) => {
				if (date) {
					onValueChange?.(format(date, "yyyy-MM-dd"));
				} else {
					onValueChange?.("");
				}
				setOpen(false);
			},
			[onValueChange],
		);

		// Parse min/max dates
		const fromDate = React.useMemo(() => {
			if (!minDate) return undefined;
			const parsed = parse(minDate, "yyyy-MM-dd", new Date());
			return isValid(parsed) ? parsed : undefined;
		}, [minDate]);

		const toDate = React.useMemo(() => {
			if (!maxDate) return undefined;
			const parsed = parse(maxDate, "yyyy-MM-dd", new Date());
			return isValid(parsed) ? parsed : undefined;
		}, [maxDate]);

		return (
			<Popover open={open} onOpenChange={handleOpenChange}>
				<PopoverTrigger asChild>
					<Button
						ref={ref}
						type="button"
						id={id}
						variant="outline"
						role="combobox"
						aria-expanded={open}
						aria-invalid={ariaInvalid}
						disabled={disabled}
						className={cn(
							"w-full justify-between font-normal",
							!value && "text-muted-foreground",
							className,
						)}
					>
						<span className="flex items-center gap-2">
							<CalendarIcon className="size-4" />
							{displayValue}
						</span>
						<ChevronDownIcon className="size-4 opacity-50" />
					</Button>
				</PopoverTrigger>
				<PopoverContent
					className="w-auto overflow-hidden p-0"
					align="start"
				>
					<Calendar
						mode="single"
						selected={selectedDate}
						onSelect={handleSelect}
						captionLayout={captionLayout}
						fromDate={fromDate}
						toDate={toDate}
						disabled={disabledDays}
						defaultMonth={selectedDate}
						autoFocus
					/>
				</PopoverContent>
			</Popover>
		);
	},
);

DatePicker.displayName = "DatePicker";

export { DatePicker };
