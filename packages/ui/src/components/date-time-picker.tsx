"use client";

import { cn } from "@repo/ui/lib/utils";
import * as React from "react";
import { DatePicker, type DatePickerProps } from "./date-picker";
import { TimePicker, type TimePickerProps } from "./time-picker";

export interface DateTimePickerProps {
	/** Date value (YYYY-MM-DD) */
	dateValue?: string;
	/** Time value (HH:mm) */
	timeValue?: string;
	/** Callback when date changes */
	onDateChange?: (value: string) => void;
	/** Callback when time changes */
	onTimeChange?: (value: string) => void;
	/** Callback when date picker loses focus */
	onDateBlur?: () => void;
	/** Callback when time picker loses focus */
	onTimeBlur?: () => void;
	/** Date placeholder */
	datePlaceholder?: string;
	/** Time placeholder */
	timePlaceholder?: string;
	/** Disabled state */
	disabled?: boolean;
	/** Date field ID */
	dateId?: string;
	/** Time field ID */
	timeId?: string;
	/** aria-invalid for validation */
	"aria-invalid"?: boolean;
	/** Additional className for container */
	className?: string;
	/** Additional props for DatePicker */
	datePickerProps?: Partial<DatePickerProps>;
	/** Additional props for TimePicker */
	timePickerProps?: Partial<TimePickerProps>;
}

function DateTimePicker({
	dateValue,
	timeValue,
	onDateChange,
	onTimeChange,
	onDateBlur,
	onTimeBlur,
	datePlaceholder = "Select date",
	timePlaceholder,
	disabled = false,
	dateId,
	timeId,
	"aria-invalid": ariaInvalid,
	className,
	datePickerProps,
	timePickerProps,
}: DateTimePickerProps) {
	return (
		<div className={cn("flex gap-2", className)}>
			<DatePicker
				value={dateValue}
				onValueChange={onDateChange}
				onBlur={onDateBlur}
				placeholder={datePlaceholder}
				disabled={disabled}
				id={dateId}
				aria-invalid={ariaInvalid}
				className="flex-1"
				{...datePickerProps}
			/>
			<TimePicker
				value={timeValue}
				onValueChange={onTimeChange}
				onBlur={onTimeBlur}
				placeholder={timePlaceholder}
				disabled={disabled}
				id={timeId}
				aria-invalid={ariaInvalid}
				className="w-32"
				{...timePickerProps}
			/>
		</div>
	);
}

export { DateTimePicker };
