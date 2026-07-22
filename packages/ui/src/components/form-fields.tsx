"use client";

import { DatePicker } from "@repo/ui/components/date-picker";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { PasswordInput } from "@repo/ui/components/password-input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Textarea } from "@repo/ui/components/textarea";
import type * as React from "react";
import {
	type Control,
	Controller,
	type ControllerFieldState,
	type ControllerRenderProps,
	type FieldPath,
	type FieldValues,
} from "react-hook-form";

/**
 * Thin react-hook-form field wrappers built on the `field.tsx` primitives.
 * These are the canonical way to render form fields: micro uppercase label,
 * compact control, inline validation error.
 *
 * Usage:
 *   <TextField control={form.control} name="name" label="Name" required />
 */

type BaseFieldProps<
	TFieldValues extends FieldValues,
	TName extends FieldPath<TFieldValues>,
> = {
	control: Control<TFieldValues>;
	name: TName;
	/**
	 * Omit when the surrounding layout already labels the field
	 * (e.g. single-field settings rows).
	 */
	label?: string;
	description?: string;
	required?: boolean;
	disabled?: boolean;
	className?: string;
};

function FieldShell({
	label,
	name,
	required,
	description,
	className,
	fieldState,
	children,
}: {
	label?: string;
	name: string;
	required?: boolean;
	description?: string;
	className?: string;
	fieldState: ControllerFieldState;
	children: React.ReactNode;
}) {
	return (
		<Field
			data-invalid={fieldState.invalid}
			className={className ? `gap-2 ${className}` : "gap-2"}
		>
			{label ? (
				<FieldLabel variant="micro" htmlFor={name}>
					{required ? `${label} *` : label}
				</FieldLabel>
			) : null}
			{children}
			{description ? (
				<FieldDescription className="text-13">
					{description}
				</FieldDescription>
			) : null}
			{fieldState.invalid ? (
				<FieldError className="text-13" errors={[fieldState.error]} />
			) : null}
		</Field>
	);
}

export function TextField<
	TFieldValues extends FieldValues,
	TName extends FieldPath<TFieldValues>,
>({
	control,
	name,
	label,
	description,
	required,
	disabled,
	className,
	type = "text",
	placeholder,
	autoComplete,
}: BaseFieldProps<TFieldValues, TName> & {
	type?: React.HTMLInputTypeAttribute;
	placeholder?: string;
	autoComplete?: string;
}) {
	return (
		<Controller
			name={name}
			control={control}
			render={({ field, fieldState }) => (
				<FieldShell
					label={label}
					name={name}
					required={required}
					description={description}
					className={className}
					fieldState={fieldState}
				>
					<Input
						{...field}
						value={field.value ?? ""}
						id={name}
						size="sm"
						type={type}
						placeholder={placeholder}
						autoComplete={autoComplete}
						disabled={disabled}
						aria-invalid={fieldState.invalid}
					/>
				</FieldShell>
			)}
		/>
	);
}

export function PasswordField<
	TFieldValues extends FieldValues,
	TName extends FieldPath<TFieldValues>,
>({
	control,
	name,
	label,
	description,
	required,
	disabled,
	className,
	placeholder,
	autoComplete,
}: BaseFieldProps<TFieldValues, TName> & {
	placeholder?: string;
	autoComplete?: string;
}) {
	return (
		<Controller
			name={name}
			control={control}
			render={({ field, fieldState }) => (
				<FieldShell
					label={label}
					name={name}
					required={required}
					description={description}
					className={className}
					fieldState={fieldState}
				>
					<PasswordInput
						{...field}
						value={field.value ?? ""}
						id={name}
						size="sm"
						placeholder={placeholder}
						autoComplete={autoComplete}
						disabled={disabled}
						aria-invalid={fieldState.invalid}
					/>
				</FieldShell>
			)}
		/>
	);
}

export function NumberField<
	TFieldValues extends FieldValues,
	TName extends FieldPath<TFieldValues>,
>({
	control,
	name,
	label,
	description,
	required,
	disabled,
	className,
	placeholder,
	min,
	max,
	step,
}: BaseFieldProps<TFieldValues, TName> & {
	placeholder?: string;
	min?: number;
	max?: number;
	step?: number | "any";
}) {
	return (
		<Controller
			name={name}
			control={control}
			render={({ field, fieldState }) => (
				<FieldShell
					label={label}
					name={name}
					required={required}
					description={description}
					className={className}
					fieldState={fieldState}
				>
					<Input
						{...field}
						value={field.value ?? ""}
						onChange={(event) => {
							const { value } = event.target;
							field.onChange(value === "" ? "" : Number(value));
						}}
						id={name}
						size="sm"
						type="number"
						placeholder={placeholder}
						min={min}
						max={max}
						step={step}
						disabled={disabled}
						aria-invalid={fieldState.invalid}
					/>
				</FieldShell>
			)}
		/>
	);
}

export function TextareaField<
	TFieldValues extends FieldValues,
	TName extends FieldPath<TFieldValues>,
>({
	control,
	name,
	label,
	description,
	required,
	disabled,
	className,
	placeholder,
	rows,
}: BaseFieldProps<TFieldValues, TName> & {
	placeholder?: string;
	rows?: number;
}) {
	return (
		<Controller
			name={name}
			control={control}
			render={({ field, fieldState }) => (
				<FieldShell
					label={label}
					name={name}
					required={required}
					description={description}
					className={className}
					fieldState={fieldState}
				>
					<Textarea
						{...field}
						value={field.value ?? ""}
						id={name}
						size="sm"
						placeholder={placeholder}
						rows={rows}
						className="resize-none"
						disabled={disabled}
						aria-invalid={fieldState.invalid}
					/>
				</FieldShell>
			)}
		/>
	);
}

export function SelectField<
	TFieldValues extends FieldValues,
	TName extends FieldPath<TFieldValues>,
>({
	control,
	name,
	label,
	description,
	required,
	disabled,
	className,
	placeholder,
	options,
}: BaseFieldProps<TFieldValues, TName> & {
	placeholder?: string;
	options: ReadonlyArray<{ value: string; label: React.ReactNode }>;
}) {
	return (
		<Controller
			name={name}
			control={control}
			render={({ field, fieldState }) => (
				<FieldShell
					label={label}
					name={name}
					required={required}
					description={description}
					className={className}
					fieldState={fieldState}
				>
					<Select
						value={field.value ?? ""}
						onValueChange={field.onChange}
						disabled={disabled}
					>
						<SelectTrigger
							id={name}
							size="sm"
							className="w-full text-13"
							aria-invalid={fieldState.invalid}
							onBlur={field.onBlur}
						>
							<SelectValue placeholder={placeholder} />
						</SelectTrigger>
						<SelectContent>
							{options.map((option) => (
								<SelectItem
									key={option.value}
									value={option.value}
								>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</FieldShell>
			)}
		/>
	);
}

export function DateField<
	TFieldValues extends FieldValues,
	TName extends FieldPath<TFieldValues>,
>({
	control,
	name,
	label,
	description,
	required,
	disabled,
	className,
	placeholder,
	minDate,
	maxDate,
}: BaseFieldProps<TFieldValues, TName> & {
	placeholder?: string;
	minDate?: string;
	maxDate?: string;
}) {
	return (
		<Controller
			name={name}
			control={control}
			render={({ field, fieldState }) => (
				<FieldShell
					label={label}
					name={name}
					required={required}
					description={description}
					className={className}
					fieldState={fieldState}
				>
					<DatePicker
						id={name}
						value={field.value ?? ""}
						onValueChange={field.onChange}
						onBlur={field.onBlur}
						placeholder={placeholder}
						minDate={minDate}
						maxDate={maxDate}
						disabled={disabled}
						aria-invalid={fieldState.invalid}
						className="h-8 px-2.5 text-13"
					/>
				</FieldShell>
			)}
		/>
	);
}

/**
 * Escape hatch for custom controls (combobox, money input, uploads, ...):
 * gives you the Controller field/fieldState inside the standard shell.
 */
export function CustomField<
	TFieldValues extends FieldValues,
	TName extends FieldPath<TFieldValues>,
>({
	control,
	name,
	label,
	description,
	required,
	className,
	children,
}: Omit<BaseFieldProps<TFieldValues, TName>, "disabled"> & {
	children: (props: {
		field: ControllerRenderProps<TFieldValues, TName>;
		fieldState: ControllerFieldState;
	}) => React.ReactNode;
}) {
	return (
		<Controller
			name={name}
			control={control}
			render={({ field, fieldState }) => (
				<FieldShell
					label={label}
					name={name}
					required={required}
					description={description}
					className={className}
					fieldState={fieldState}
				>
					{children({ field, fieldState })}
				</FieldShell>
			)}
		/>
	);
}
