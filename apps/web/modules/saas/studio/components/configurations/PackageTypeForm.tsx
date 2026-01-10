"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Configuration } from "@repo/api/modules/studio/schemas/configuration";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Switch } from "@repo/ui/components/switch";
import { Textarea } from "@repo/ui/components/textarea";
import { configurationsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { PlusIcon, TrashIcon } from "lucide-react";
import { useCallback, useEffect } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { CollapsibleSection } from "../ui/CollapsibleSection";
import { FormActions } from "../ui/FormActions";

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
	defaultCost: z.string().optional(),
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
			defaultDeliverables: [],
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
				bookingType: metadata?.bookingType ?? "",
				defaultCost: metadata?.defaultCost ?? "",
				defaultDeliverables: metadata?.defaultDeliverables ?? [],
			});
		}
	}, [defaultValues, form, metadata]);

	const isSubmitting = form.formState.isSubmitting || isPending;

	const handleAddDeliverable = () => {
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
						<Controller
							name="label"
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor={field.name}>
										Label *
									</FieldLabel>
									<Input
										{...field}
										id={field.name}
										placeholder="e.g., Premium Wedding Package"
										aria-invalid={fieldState.invalid}
									/>
									{fieldState.invalid && (
										<FieldError
											errors={[fieldState.error]}
										/>
									)}
								</Field>
							)}
						/>

						{/* Package Settings (Always Visible - Core Feature) */}
						<div className="space-y-4 pt-2">
							<h4 className="text-sm font-medium text-muted-foreground">
								Package Settings
							</h4>

							<FieldGroup>
								<div className="grid grid-cols-2 gap-4">
									<Controller
										name="bookingType"
										control={form.control}
										render={({ field, fieldState }) => (
											<Field
												data-invalid={
													fieldState.invalid
												}
											>
												<FieldLabel
													htmlFor={field.name}
												>
													Booking Type Filter
												</FieldLabel>
												<Select
													value={
														field.value || "__all__"
													}
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
																	key={
																		type.key
																	}
																	value={
																		type.key
																	}
																>
																	{type.label}
																</SelectItem>
															),
														)}
													</SelectContent>
												</Select>
												{fieldState.invalid && (
													<FieldError
														errors={[
															fieldState.error,
														]}
													/>
												)}
											</Field>
										)}
									/>

									<Controller
										name="defaultCost"
										control={form.control}
										render={({ field, fieldState }) => (
											<Field
												data-invalid={
													fieldState.invalid
												}
											>
												<FieldLabel
													htmlFor={field.name}
												>
													Default Cost
												</FieldLabel>
												<Input
													{...field}
													id={field.name}
													type="number"
													step="0.01"
													min="0"
													placeholder="0.00"
													aria-invalid={
														fieldState.invalid
													}
												/>
												{fieldState.invalid && (
													<FieldError
														errors={[
															fieldState.error,
														]}
													/>
												)}
											</Field>
										)}
									/>
								</div>
							</FieldGroup>

							{/* Default Deliverables */}
							<div className="space-y-3">
								<div className="flex items-center justify-between">
									<div>
										<h4 className="text-sm font-medium">
											Default Deliverables
										</h4>
										<p className="text-xs text-muted-foreground">
											Auto-added when this package is
											selected
										</p>
									</div>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={handleAddDeliverable}
									>
										<PlusIcon className="h-4 w-4 mr-1" />
										Add
									</Button>
								</div>

								{fields.length === 0 ? (
									<Card className="border-dashed">
										<CardContent className="py-4 text-center text-sm text-muted-foreground">
											No default deliverables. Click "Add"
											to include deliverables with this
											package.
										</CardContent>
									</Card>
								) : (
									<div className="space-y-2">
										{fields.map((fieldItem, index) => (
											<Card key={fieldItem.id}>
												<CardContent className="pt-3 pb-2">
													<div className="grid grid-cols-[1fr_70px_32px] gap-2 items-start">
														<Controller
															name={`defaultDeliverables.${index}.title`}
															control={
																form.control
															}
															render={({
																field,
																fieldState,
															}) => (
																<Field
																	data-invalid={
																		fieldState.invalid
																	}
																>
																	<Input
																		{...field}
																		id={
																			field.name
																		}
																		placeholder="Name"
																		aria-invalid={
																			fieldState.invalid
																		}
																	/>
																	{fieldState.invalid && (
																		<FieldError
																			errors={[
																				fieldState.error,
																			]}
																		/>
																	)}
																</Field>
															)}
														/>

														<Controller
															name={`defaultDeliverables.${index}.quantity`}
															control={
																form.control
															}
															render={({
																field,
																fieldState,
															}) => (
																<Field
																	data-invalid={
																		fieldState.invalid
																	}
																>
																	<Input
																		id={
																			field.name
																		}
																		type="number"
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
																	{fieldState.invalid && (
																		<FieldError
																			errors={[
																				fieldState.error,
																			]}
																		/>
																	)}
																</Field>
															)}
														/>

														<Button
															type="button"
															variant="ghost"
															size="icon"
															className="h-10 w-10 text-muted-foreground hover:text-destructive"
															onClick={() =>
																remove(index)
															}
														>
															<TrashIcon className="h-4 w-4" />
														</Button>
													</div>
												</CardContent>
											</Card>
										))}
									</div>
								)}
							</div>
						</div>

						{/* Advanced Options (Collapsible) */}
						<CollapsibleSection
							title="Advanced Options"
							defaultOpen={mode === "edit"}
						>
							<FieldGroup>
								<Controller
									name="description"
									control={form.control}
									render={({ field, fieldState }) => (
										<Field
											data-invalid={fieldState.invalid}
										>
											<FieldLabel htmlFor={field.name}>
												Description
											</FieldLabel>
											<Textarea
												{...field}
												id={field.name}
												placeholder="Optional package description"
												className="resize-none"
												rows={2}
												aria-invalid={
													fieldState.invalid
												}
											/>
											{fieldState.invalid && (
												<FieldError
													errors={[fieldState.error]}
												/>
											)}
										</Field>
									)}
								/>

								<div className="grid grid-cols-2 gap-4">
									<Controller
										name="color"
										control={form.control}
										render={({ field, fieldState }) => (
											<Field
												data-invalid={
													fieldState.invalid
												}
											>
												<FieldLabel
													htmlFor={field.name}
												>
													Color
												</FieldLabel>
												<div className="flex gap-2">
													<Input
														type="color"
														className="w-12 h-10 p-1 cursor-pointer"
														value={
															field.value ||
															"#6B7280"
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
														placeholder="#6B7280"
														className="flex-1"
														aria-invalid={
															fieldState.invalid
														}
													/>
												</div>
												{fieldState.invalid && (
													<FieldError
														errors={[
															fieldState.error,
														]}
													/>
												)}
											</Field>
										)}
									/>

									<Controller
										name="sortOrder"
										control={form.control}
										render={({ field, fieldState }) => (
											<Field
												data-invalid={
													fieldState.invalid
												}
											>
												<FieldLabel
													htmlFor={field.name}
												>
													Sort Order
												</FieldLabel>
												<Input
													id={field.name}
													type="number"
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
												{fieldState.invalid && (
													<FieldError
														errors={[
															fieldState.error,
														]}
													/>
												)}
											</Field>
										)}
									/>
								</div>

								<Controller
									name="isDefault"
									control={form.control}
									render={({ field, fieldState }) => (
										<Field
											data-invalid={fieldState.invalid}
											orientation="horizontal"
											className="rounded-lg border p-3"
										>
											<div className="space-y-0.5">
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
										</Field>
									)}
								/>
							</FieldGroup>
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
