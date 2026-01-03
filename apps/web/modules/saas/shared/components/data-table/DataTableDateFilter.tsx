"use client";

import { Button } from "@repo/ui/components/button";
import { Calendar } from "@repo/ui/components/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@repo/ui/components/popover";
import { Separator } from "@repo/ui/components/separator";
import { CalendarIcon, XCircleIcon } from "lucide-react";
import * as React from "react";
import type { DateRange } from "react-day-picker";

/**
 * Date filter value type.
 * For single date mode: string in YYYY-MM-DD format
 * For range mode: { from?: string; to?: string } in YYYY-MM-DD format
 */
export type DateFilterValue = string | { from?: string; to?: string } | null;

interface DataTableDateFilterProps {
	/** Filter title displayed on the button */
	title: string;
	/** Current filter value */
	value: DateFilterValue;
	/** Callback when value changes */
	onValueChange: (value: DateFilterValue) => void;
	/** Whether to use range mode (from/to) or single date */
	multiple?: boolean;
	/** Icon to display in the button */
	icon?: React.ComponentType<{ className?: string }>;
}

function parseAsDate(dateString: string | undefined): Date | undefined {
	if (!dateString) {
		return undefined;
	}

	const [year, month, day] = dateString.split("-").map(Number);
	if (year === undefined || month === undefined || day === undefined) {
		return undefined;
	}

	const date = new Date(year, month - 1, day);
	return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatDateAsString(date: Date | undefined): string | undefined {
	if (!date) {
		return undefined;
	}

	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDateForDisplay(dateString: string | undefined): string {
	if (!dateString) {
		return "";
	}
	const date = parseAsDate(dateString);
	if (!date) {
		return "";
	}
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export function DataTableDateFilter({
	title,
	value,
	onValueChange,
	multiple = false,
	icon: Icon,
}: DataTableDateFilterProps) {
	// Convert value to internal representation
	const selectedDates = React.useMemo<Date[] | DateRange>(() => {
		if (!value) {
			return multiple ? { from: undefined, to: undefined } : [];
		}

		if (multiple && typeof value === "object" && !Array.isArray(value)) {
			return {
				from: parseAsDate(value.from),
				to: parseAsDate(value.to),
			};
		}

		if (!multiple && typeof value === "string") {
			const date = parseAsDate(value);
			return date ? [date] : [];
		}

		return multiple ? { from: undefined, to: undefined } : [];
	}, [value, multiple]);

	const onSelect = React.useCallback(
		(date: Date | DateRange | undefined) => {
			if (!date) {
				onValueChange(null);
				return;
			}

			if (multiple && typeof date === "object" && !("getTime" in date)) {
				const from = formatDateAsString(date.from);
				const to = formatDateAsString(date.to);
				if (from || to) {
					onValueChange({ from, to });
				} else {
					onValueChange(null);
				}
			} else if (!multiple && date instanceof Date) {
				const formatted = formatDateAsString(date);
				onValueChange(formatted ?? null);
			}
		},
		[multiple, onValueChange],
	);

	const onReset = React.useCallback(
		(event: React.MouseEvent) => {
			event.stopPropagation();
			onValueChange(null);
		},
		[onValueChange],
	);

	const hasValue = React.useMemo(() => {
		if (!value) {
			return false;
		}
		if (multiple && typeof value === "object" && !Array.isArray(value)) {
			return Boolean(value.from || value.to);
		}
		return typeof value === "string" && value.length > 0;
	}, [value, multiple]);

	const displayLabel = React.useMemo(() => {
		if (!value) {
			return null;
		}

		if (multiple && typeof value === "object" && !Array.isArray(value)) {
			if (!value.from && !value.to) {
				return null;
			}
			if (value.from && value.to) {
				return `${formatDateForDisplay(value.from)} - ${formatDateForDisplay(value.to)}`;
			}
			return formatDateForDisplay(value.from ?? value.to);
		}

		if (typeof value === "string") {
			return formatDateForDisplay(value);
		}

		return null;
	}, [value, multiple]);

	const IconComponent = Icon ?? CalendarIcon;

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className="h-8 border-dashed"
				>
					{hasValue ? (
						// biome-ignore lint/a11y/useSemanticElements: Cannot nest button inside PopoverTrigger button
						<span
							role="button"
							tabIndex={0}
							aria-label={`Clear ${title} filter`}
							onClick={onReset}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									onReset(e as unknown as React.MouseEvent);
								}
							}}
							className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
						>
							<XCircleIcon className="h-4 w-4" />
						</span>
					) : (
						<IconComponent className="mr-2 h-4 w-4" />
					)}
					<span>{title}</span>
					{displayLabel && (
						<>
							<Separator
								orientation="vertical"
								className="mx-2 h-4"
							/>
							<span className="font-normal">{displayLabel}</span>
						</>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto p-0" align="start">
				{multiple ? (
					<Calendar
						mode="range"
						selected={
							!Array.isArray(selectedDates)
								? selectedDates
								: { from: undefined, to: undefined }
						}
						onSelect={onSelect}
					/>
				) : (
					<Calendar
						mode="single"
						selected={
							Array.isArray(selectedDates)
								? selectedDates[0]
								: undefined
						}
						onSelect={onSelect}
					/>
				)}
			</PopoverContent>
		</Popover>
	);
}
