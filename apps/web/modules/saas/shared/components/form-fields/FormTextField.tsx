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
import type { Control, FieldPath, FieldValues } from "react-hook-form";

interface FormTextFieldProps<
	TFieldValues extends FieldValues,
	TName extends FieldPath<TFieldValues>,
> {
	control: Control<TFieldValues>;
	name: TName;
	label: string;
	placeholder?: string;
	description?: string;
	type?: "text" | "email" | "tel" | "url";
	disabled?: boolean;
	autoComplete?: string;
	className?: string;
}

export function FormTextField<
	TFieldValues extends FieldValues,
	TName extends FieldPath<TFieldValues>,
>({
	control,
	name,
	label,
	placeholder,
	description,
	type = "text",
	disabled,
	autoComplete,
	className,
}: FormTextFieldProps<TFieldValues, TName>) {
	return (
		<FormField
			control={control}
			name={name}
			render={({ field }) => (
				<FormItem className={className}>
					<FormLabel>{label}</FormLabel>
					<FormControl>
						<Input
							{...field}
							type={type}
							placeholder={placeholder}
							disabled={disabled}
							autoComplete={autoComplete}
						/>
					</FormControl>
					{description && <FormDescription>{description}</FormDescription>}
					<FormMessage />
				</FormItem>
			)}
		/>
	);
}
