"use client";

import {
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@repo/ui/components/form";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import type { Control, FieldPath, FieldValues } from "react-hook-form";

export interface SelectOption {
	value: string;
	label: string;
	disabled?: boolean;
}

interface FormSelectFieldProps<
	TFieldValues extends FieldValues,
	TName extends FieldPath<TFieldValues>,
> {
	control: Control<TFieldValues>;
	name: TName;
	label: string;
	options: SelectOption[];
	placeholder?: string;
	description?: string;
	disabled?: boolean;
	className?: string;
}

export function FormSelectField<
	TFieldValues extends FieldValues,
	TName extends FieldPath<TFieldValues>,
>({
	control,
	name,
	label,
	options,
	placeholder = "Select...",
	description,
	disabled,
	className,
}: FormSelectFieldProps<TFieldValues, TName>) {
	return (
		<FormField
			control={control}
			name={name}
			render={({ field }) => (
				<FormItem className={className}>
					<FormLabel>{label}</FormLabel>
					<Select
						onValueChange={field.onChange}
						defaultValue={field.value}
						disabled={disabled}
					>
						<FormControl>
							<SelectTrigger>
								<SelectValue placeholder={placeholder} />
							</SelectTrigger>
						</FormControl>
						<SelectContent>
							{options.map((option) => (
								<SelectItem
									key={option.value}
									value={option.value}
									disabled={option.disabled}
								>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{description && <FormDescription>{description}</FormDescription>}
					<FormMessage />
				</FormItem>
			)}
		/>
	);
}
