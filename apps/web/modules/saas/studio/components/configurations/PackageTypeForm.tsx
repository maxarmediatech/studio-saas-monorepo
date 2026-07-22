"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Configuration } from "@repo/api/modules/studio/schemas/configuration";
import { Card, CardContent } from "@repo/ui/components/card";
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
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from "@repo/ui/components/input-group";
import {
	AddItemButton,
	ItemCard,
	ItemCardHeader,
} from "@repo/ui/components/item-list";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Switch } from "@repo/ui/components/switch";
import { configurationsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { CollapsibleSection } from "../ui/CollapsibleSection";
import { FormActions } from "../ui/FormActions";
import { PACKAGE_DELIVERABLE_TEMPLATES } from "./package-deliverable-templates";

const defaultDeliverableSchema = z.object({
	title: z.string().min(1, "Title is required"),
	quantity: z.number().int().min(1, "Quantity must be at least 1"),
});

const packageTypeFormSchema = z.object({
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
	bookingType: z.string().optional(),
	defaultCost: z
		.string()
		.trim()
		.min(1, "Default cost is required")
		.refine((value) => {
			const numericValue = Number(value);
			return Number.isFinite(numericValue) && numericValue > 0;
		}, "Default cost must be greater than 0"),
	defaultDeliverables: z.array(defaultDeliverableSchema).optional(),
});

export type PackageTypeFormValues = z.infer<typeof packageTypeFormSchema>;

interface PackageTypeFormProps {
	defaultValues?: Configuration;
	onSubmit: (data: PackageTypeFormValues) => Promise<void>;
	mode: "create" | "edit";
	isPending?: boolean;
	onScrollChange?: (isScrolled: boolean) => void;
}

export function PackageTypeForm({
	defaultValues,
	onSubmit,
	mode,
	isPending = false,
	onScrollChange,
}: PackageTypeFormProps) {
	const { data: bookingTypesData } = useQuery(
		configurationsApi.bookingTypesOptions(),
	);
	const bookingTypes = bookingTypesData?.data ?? [];

	const metadata = defaultValues?.metadata as {
		bookingType?: string;
		defaultCost?: string;
		defaultDeliverables?: Array<{
			title: string;
			quantity: number;
		}>;
	} | null;

	const form = useForm<PackageTypeFormValues>({
		resolver: zodResolver(packageTypeFormSchema),
		defaultValues: {
			label: "",
			description: "",
			color: "",
			sortOrder: 0,
			isDefault: false,
			bookingType: "",
			defaultCost: "",
			defaultDeliverables:
				mode === "create"
					? PACKAGE_DELIVERABLE_TEMPLATES.map((template) => ({
							...template,
						}))
					: [],
		},
	});

	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "defaultDeliverables",
	});

	useEffect(() => {
		if (defaultValues) {
			form.reset({
				label: defaultValues.label,
				description: defaultValues.description ?? "",
				color: defaultValues.color ?? "",
				sortOrder: defaultValues.sortOrder,
				isDefault: defaultValues.isDefault,
				bookingType:
					defaultValues.bookingTypeFilter ??
					metadata?.bookingType ??
					"",
				defaultCost:
					defaultValues.defaultCost ?? metadata?.defaultCost ?? "",
				defaultDeliverables: metadata?.defaultDeliverables ?? [],
			});
		}
	}, [defaultValues, form, metadata]);

	const isSubmitting = form.formState.isSubmitting || isPending;

	const handleAddDeliverable = () => {
		const currentDeliverables = form.getValues("defaultDeliverables") ?? [];
		const incompleteIndex = currentDeliverables.findIndex(
			(deliverable) => !deliverable?.title?.trim(),
		);

		if (incompleteIndex !== -1) {
			toast.warning(
				"Complete the current deliverable name before adding another.",
			);
			form.setFocus(`defaultDeliverables.${incompleteIndex}.title`);
			return;
		}

		append({ title: "", quantity: 1 });
	};

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
								placeholder="e.g., Premium Wedding Package"
								required
							/>

							{/* Package Settings (Always Visible - Core Feature) */}
							<div className="space-y-4 pt-2">
								<h4 className="text-sm font-medium text-muted-foreground">
									Package Settings
								</h4>

								<FieldRow>
									<CustomField
										control={form.control}
										name="bookingType"
										label="Booking Type Filter"
									>
										{({ field, fieldState }) => (
											<Select
												value={field.value || "__all__"}
												onValueChange={(value) =>
													field.onChange(
														value === "__all__"
															? ""
															: value,
													)
												}
											>
												<SelectTrigger
													id={field.name}
													size="sm"
													className="w-full text-13"
													aria-invalid={
														fieldState.invalid
													}
												>
													<SelectValue placeholder="All booking types" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="__all__">
														All booking types
													</SelectItem>
													{bookingTypes.map(
														(type) => (
															<SelectItem
																key={type.key}
																value={type.key}
															>
																{type.label}
															</SelectItem>
														),
													)}
												</SelectContent>
											</Select>
										)}
									</CustomField>

									<CustomField
										control={form.control}
										name="defaultCost"
										label="Default Cost"
										required
									>
										{({ field, fieldState }) => (
											<InputGroup>
												<InputGroupAddon>
													<InputGroupText>
														₹
													</InputGroupText>
												</InputGroupAddon>
												<InputGroupInput
													{...field}
													id={field.name}
													type="number"
													step="0.01"
													min="0.01"
													placeholder="0.00"
													aria-invalid={
														fieldState.invalid
													}
												/>
											</InputGroup>
										)}
									</CustomField>
								</FieldRow>

								{/* Default Deliverables */}
								<div className="space-y-3">
									<div>
										<h4 className="text-sm font-medium">
											Default Deliverables
										</h4>
										<p className="text-xs text-muted-foreground">
											Auto-added when this package is
											selected
										</p>
									</div>

									{fields.length === 0 ? (
										<Card className="border-dashed">
											<CardContent className="py-4 text-center text-sm text-muted-foreground">
												No default deliverables. Click
												"Add" to include deliverables
												with this package.
											</CardContent>
										</Card>
									) : (
										<div className="space-y-3">
											{fields.map((fieldItem, index) => (
												<ItemCard key={fieldItem.id}>
													<ItemCardHeader
														title={`Deliverable ${index + 1}`}
														onRemove={() =>
															remove(index)
														}
													/>
													<FieldRow>
														<CustomField
															control={
																form.control
															}
															name={`defaultDeliverables.${index}.title`}
															label="Name"
														>
															{({
																field,
																fieldState,
															}) => (
																<Input
																	{...field}
																	id={
																		field.name
																	}
																	size="sm"
																	placeholder="Name"
																	aria-invalid={
																		fieldState.invalid
																	}
																/>
															)}
														</CustomField>

														<CustomField
															control={
																form.control
															}
															name={`defaultDeliverables.${index}.quantity`}
															label="Qty"
														>
															{({
																field,
																fieldState,
															}) => (
																<Input
																	id={
																		field.name
																	}
																	type="number"
																	size="sm"
																	min={1}
																	placeholder="Qty"
																	value={
																		field.value
																	}
																	onChange={(
																		e,
																	) =>
																		field.onChange(
																			e
																				.target
																				.value
																				? Number(
																						e
																							.target
																							.value,
																					)
																				: 1,
																		)
																	}
																	aria-invalid={
																		fieldState.invalid
																	}
																/>
															)}
														</CustomField>
													</FieldRow>
												</ItemCard>
											))}
										</div>
									)}

									<AddItemButton
										onClick={handleAddDeliverable}
									>
										Add
									</AddItemButton>
								</div>
							</div>
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
									placeholder="Optional package description"
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
													Pre-select this package in
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
				<FormActions
					mode={mode}
					isSubmitting={isSubmitting}
					submitLabel={
						mode === "edit" ? "Save Changes" : "Create Package"
					}
				/>
			</div>
		</form>
	);
}
