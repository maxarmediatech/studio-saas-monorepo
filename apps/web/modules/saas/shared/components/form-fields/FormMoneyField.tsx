"use client";

import {
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import { cn } from "@repo/ui/lib/utils";
import type { Control, FieldPath, FieldValues } from "react-hook-form";

interface FormMoneyFieldProps<
	TFieldValues extends FieldValues,
	TName extends FieldPath<TFieldValues>,
> {
	control: Control<TFieldValues>;
	name: TName;
	label: string;
	currency?: string;
	placeholder?: string;
	description?: string;
	disabled?: boolean;
	className?: string;
}

export function FormMoneyField<
	TFieldValues extends FieldValues,
	TName extends FieldPath<TFieldValues>,
>({
	control,
	name,
	label,
	currency = "INR",
	placeholder = "0.00",
	description,
	disabled,
	className,
}: FormMoneyFieldProps<TFieldValues, TName>) {
	const currencySymbol = currency === "INR" ? "₹" : "$";

	return (
		<FormField
			control={control}
			name={name}
			render={({ field }) => (
				<FormItem className={className}>
					<FormLabel>{label}</FormLabel>
					<FormControl>
						<div className="relative">
							<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
								{currencySymbol}
							</span>
							<Input
								{...field}
								type="text"
								inputMode="decimal"
								placeholder={placeholder}
								disabled={disabled}
								className={cn("pl-7")}
								onChange={(e) => {
									// Allow only numbers and decimal point
									const value = e.target.value.replace(/[^0-9.]/g, "");
									// Prevent multiple decimal points
									const parts = value.split(".");
									if (parts.length > 2) {
										return;
									}
									// Limit to 2 decimal places
									if (parts[1] && parts[1].length > 2) {
										return;
									}
									field.onChange(value);
								}}
							/>
						</div>
					</FormControl>
					{description && <FormDescription>{description}</FormDescription>}
					<FormMessage />
				</FormItem>
			)}
		/>
	);
}
