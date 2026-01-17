"use client";

import { cn } from "@repo/ui/lib/utils";
import * as React from "react";

export interface TimePickerProps {
	/** Time value in HH:mm or HH:mm:ss format */
	value?: string;
	/** Callback when time changes */
	onValueChange?: (value: string) => void;
	/** Callback when input loses focus (for react-hook-form touched state) */
	onBlur?: () => void;
	/** Placeholder text */
	placeholder?: string;
	/** Disabled state */
	disabled?: boolean;
	/** ID for form association */
	id?: string;
	/** aria-invalid for form validation */
	"aria-invalid"?: boolean;
	/** Additional className */
	className?: string;
	/** Whether to include seconds (step="1") */
	showSeconds?: boolean;
	/** Minimum time (HH:mm) */
	min?: string;
	/** Maximum time (HH:mm) */
	max?: string;
}

const TimePicker = React.forwardRef<HTMLInputElement, TimePickerProps>(
	(
		{
			value,
			onValueChange,
			onBlur,
			placeholder,
			disabled = false,
			id,
			"aria-invalid": ariaInvalid,
			className,
			showSeconds = false,
			min,
			max,
		},
		ref,
	) => {
		const handleChange = React.useCallback(
			(e: React.ChangeEvent<HTMLInputElement>) => {
				onValueChange?.(e.target.value);
			},
			[onValueChange],
		);

		return (
			<input
				ref={ref}
				type="time"
				id={id}
				value={value ?? ""}
				onChange={handleChange}
				onBlur={onBlur}
				disabled={disabled}
				aria-invalid={ariaInvalid}
				placeholder={placeholder}
				min={min}
				max={max}
				step={showSeconds ? "1" : "60"}
				className={cn(
					// Base input styles (matching input.tsx)
					"file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input",
					"h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none",
					"disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
					// Focus styles
					"focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
					// Invalid styles
					"aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
					// Hide native picker indicator for consistent styling
					"appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none [&::-webkit-inner-spin-button]:hidden",
					className,
				)}
			/>
		);
	},
);

TimePicker.displayName = "TimePicker";

export { TimePicker };
