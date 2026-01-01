"use client";

import { format } from "date-fns";
import { Button } from "@repo/ui/components/button";
import { Calendar } from "@repo/ui/components/calendar";
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
import { CalendarIcon } from "lucide-react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";

interface FormDateFieldProps<
	TFieldValues extends FieldValues,
	TName extends FieldPath<TFieldValues>,
> {
	control: Control<TFieldValues>;
	name: TName;
	label: string;
	placeholder?: string;
	description?: string;
	disabled?: boolean;
	/** Minimum selectable date */
	minDate?: Date;
	/** Maximum selectable date */
	maxDate?: Date;
	/** Date format for display */
	dateFormat?: string;
	className?: string;
}

export function FormDateField<
	TFieldValues extends FieldValues,
	TName extends FieldPath<TFieldValues>,
>({
	control,
	name,
	label,
	placeholder = "Pick a date",
	description,
	disabled,
	minDate,
	maxDate,
	dateFormat = "PPP",
	className,
}: FormDateFieldProps<TFieldValues, TName>) {
	return (
		<FormField
			control={control}
			name={name}
			render={({ field }) => (
				<FormItem className={cn("flex flex-col", className)}>
					<FormLabel>{label}</FormLabel>
					<Popover>
						<PopoverTrigger asChild>
							<FormControl>
								<Button
									variant="outline"
									disabled={disabled}
									className={cn(
										"w-full justify-start text-left font-normal",
										!field.value && "text-muted-foreground",
									)}
								>
									<CalendarIcon className="mr-2 h-4 w-4" />
									{field.value ? (
										format(new Date(field.value), dateFormat)
									) : (
										<span>{placeholder}</span>
									)}
								</Button>
							</FormControl>
						</PopoverTrigger>
						<PopoverContent className="w-auto p-0" align="start">
							<Calendar
								mode="single"
								selected={field.value ? new Date(field.value) : undefined}
								onSelect={(date) => {
									field.onChange(date?.toISOString());
								}}
								disabled={(date) => {
									if (minDate && date < minDate) return true;
									if (maxDate && date > maxDate) return true;
									return false;
								}}
							/>
						</PopoverContent>
					</Popover>
					{description && <FormDescription>{description}</FormDescription>}
					<FormMessage />
				</FormItem>
			)}
		/>
	);
}
