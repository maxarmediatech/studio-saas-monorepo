"use client";

import {
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@repo/ui/components/form";
import { Textarea } from "@repo/ui/components/textarea";
import type { Control, FieldPath, FieldValues } from "react-hook-form";

interface FormTextareaFieldProps<
	TFieldValues extends FieldValues,
	TName extends FieldPath<TFieldValues>,
> {
	control: Control<TFieldValues>;
	name: TName;
	label: string;
	placeholder?: string;
	description?: string;
	rows?: number;
	disabled?: boolean;
	className?: string;
}

export function FormTextareaField<
	TFieldValues extends FieldValues,
	TName extends FieldPath<TFieldValues>,
>({
	control,
	name,
	label,
	placeholder,
	description,
	rows = 3,
	disabled,
	className,
}: FormTextareaFieldProps<TFieldValues, TName>) {
	return (
		<FormField
			control={control}
			name={name}
			render={({ field }) => (
				<FormItem className={className}>
					<FormLabel>{label}</FormLabel>
					<FormControl>
						<Textarea
							{...field}
							placeholder={placeholder}
							rows={rows}
							disabled={disabled}
							value={field.value ?? ""}
						/>
					</FormControl>
					{description && (
						<FormDescription>{description}</FormDescription>
					)}
					<FormMessage />
				</FormItem>
			)}
		/>
	);
}
