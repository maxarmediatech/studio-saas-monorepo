"use client";

import { Button } from "@repo/ui/components/button";
import { Calendar } from "@repo/ui/components/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@repo/ui/components/popover";
import { cn } from "@repo/ui/lib/utils";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { CalendarIcon } from "lucide-react";

export interface DateRange {
	from: string;
	to: string;
}

export function getDefaultDateRange(): DateRange {
	const now = new Date();
	return {
		from: format(startOfMonth(now), "yyyy-MM-dd"),
		to: format(endOfMonth(now), "yyyy-MM-dd"),
	};
}

interface DateRangeFilterProps {
	value: DateRange;
	onChange: (range: DateRange) => void;
}

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
	const fromDate = new Date(value.from);
	const toDate = new Date(value.to);

	const handleSelect = (range: { from?: Date; to?: Date } | undefined) => {
		if (range?.from && range?.to) {
			onChange({
				from: format(range.from, "yyyy-MM-dd"),
				to: format(range.to, "yyyy-MM-dd"),
			});
		}
	};

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className={cn(
						"justify-start text-left font-normal",
						!value && "text-muted-foreground",
					)}
				>
					<CalendarIcon className="mr-2 size-4" />
					{format(fromDate, "MMM d")} -{" "}
					{format(toDate, "MMM d, yyyy")}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto p-0" align="end">
				<Calendar
					mode="range"
					defaultMonth={fromDate}
					selected={{ from: fromDate, to: toDate }}
					onSelect={handleSelect}
					numberOfMonths={2}
				/>
			</PopoverContent>
		</Popover>
	);
}
