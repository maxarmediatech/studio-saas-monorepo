"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Configuration } from "@repo/api/modules/studio/schemas/configuration";
import {
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@repo/ui/components/field";
import {
	CustomField,
	TextareaField,
	TextField,
} from "@repo/ui/components/form-fields";
import { FieldRow, FormSection } from "@repo/ui/components/form-section";
import { Input } from "@repo/ui/components/input";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { Switch } from "@repo/ui/components/switch";
import { useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CollapsibleSection } from "../ui/CollapsibleSection";
import { FormActions } from "../ui/FormActions";

const configurationFormSchema = z.object({
	label: z
		.string()
		.min(1, "Label is required")
		.max(255)
		.refine(
			(val) => /[a-zA-Z0-9]/.test(val),
			"Label must contain at least one letter or number",
		),
	description: z.string().max(1000).optional().or(z.literal("")),
	color: z
		.string()
		.regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color")
		.optional()
		.or(z.literal("")),
	sortOrder: z.number().int().min(0).optional(),
	isDefault: z.boolean().optional(),
});

export type ConfigurationFormValues = z.infer<typeof configurationFormSchema>;

interface ConfigurationFormProps {
	defaultValues?: Configuration;
	onSubmit: (data: ConfigurationFormValues) => Promise<void>;
	mode: "create" | "edit";
	isPending?: boolean;
	onScrollChange?: (isScrolled: boolean) => void;
}

export function ConfigurationForm({
	defaultValues,
	onSubmit,
	mode,
	isPending = false,
	onScrollChange,
}: ConfigurationFormProps) {
	const form = useForm<ConfigurationFormValues>({
		resolver: zodResolver(configurationFormSchema),
		defaultValues: {
			label: "",
			description: "",
			color: "",
			sortOrder: 0,
			isDefault: false,
		},
	});

	useEffect(() => {
		if (defaultValues) {
			form.reset({
				label: defaultValues.label,
				description: defaultValues.description ?? "",
				color: defaultValues.color ?? "",
				sortOrder: defaultValues.sortOrder,
				isDefault: defaultValues.isDefault,
			});
		}
	}, [defaultValues, form]);

	const isSubmitting = form.formState.isSubmitting || isPending;

	const handleScroll = useCallback(
		(event: React.UIEvent<HTMLDivElement>) => {
			const target = event.target as HTMLDivElement;
			const isScrolled = target.scrollTop > 0;
			onScrollChange?.(isScrolled);
		},
		[onScrollChange],
	);

	return (
		<form
			onSubmit={form.handleSubmit(onSubmit)}
			className="flex flex-col h-full min-h-0"
		>
			<ScrollArea
				className="flex-1 min-h-0"
				onScrollCapture={handleScroll}
			>
				<div className="px-4 py-4">
					<FieldGroup>
						<FormSection>
							<TextField
								control={form.control}
								name="label"
								label="Label"
								placeholder="Display name"
								required
							/>
						</FormSection>

						{/* Advanced Options (Collapsible) */}
						<CollapsibleSection
							title="Advanced Options"
							defaultOpen={mode === "edit"}
						>
							<FormSection>
								<TextareaField
									control={form.control}
									name="description"
									label="Description"
									placeholder="Optional description"
									rows={2}
								/>

								<FieldRow>
									<CustomField
										control={form.control}
										name="color"
										label="Color"
									>
										{({ field, fieldState }) => (
											<div className="flex gap-2">
												<Input
													type="color"
													className="w-12 h-10 p-1 cursor-pointer"
													value={
														field.value || "#6B7280"
													}
													onChange={(e) =>
														field.onChange(
															e.target.value,
														)
													}
												/>
												<Input
													{...field}
													id={field.name}
													size="sm"
													placeholder="#6B7280"
													className="flex-1"
													aria-invalid={
														fieldState.invalid
													}
												/>
											</div>
										)}
									</CustomField>

									<CustomField
										control={form.control}
										name="sortOrder"
										label="Sort Order"
									>
										{({ field, fieldState }) => (
											<Input
												id={field.name}
												type="number"
												size="sm"
												min={0}
												placeholder="0"
												value={field.value ?? 0}
												onChange={(e) =>
													field.onChange(
														e.target.value
															? Number(
																	e.target
																		.value,
																)
															: 0,
													)
												}
												aria-invalid={
													fieldState.invalid
												}
											/>
										)}
									</CustomField>
								</FieldRow>

								<CustomField
									control={form.control}
									name="isDefault"
									className="rounded-lg border p-3"
								>
									{({ field }) => (
										<div className="flex flex-row items-center gap-2">
											<div className="flex-1 space-y-0.5">
												<FieldLabel
													htmlFor={field.name}
												>
													Default
												</FieldLabel>
												<FieldDescription>
													Pre-select this option in
													forms
												</FieldDescription>
											</div>
											<Switch
												id={field.name}
												checked={field.value}
												onCheckedChange={field.onChange}
											/>
										</div>
									)}
								</CustomField>
							</FormSection>
						</CollapsibleSection>
					</FieldGroup>
				</div>
			</ScrollArea>

			<div className="shrink-0 border-t p-4 bg-background">
				<FormActions mode={mode} isSubmitting={isSubmitting} />
			</div>
		</form>
	);
}
