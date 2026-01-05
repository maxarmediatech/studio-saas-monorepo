"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Configuration } from "@repo/api/modules/studio/schemas/configuration";
import { Card, CardContent } from "@repo/ui/components/card";
import { Checkbox } from "@repo/ui/components/checkbox";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { Switch } from "@repo/ui/components/switch";
import { Textarea } from "@repo/ui/components/textarea";
import { configurationsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { CollapsibleSection } from "../ui/CollapsibleSection";
import { FormActions } from "../ui/FormActions";

const eventTypeFormSchema = z.object({
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
	applicableBookingTypes: z.array(z.string()).optional(),
});

export type EventTypeFormValues = z.infer<typeof eventTypeFormSchema>;

interface EventTypeFormProps {
	defaultValues?: Configuration;
	onSubmit: (data: EventTypeFormValues) => Promise<void>;
	mode: "create" | "edit";
	isPending?: boolean;
	onScrollChange?: (isScrolled: boolean) => void;
}

export function EventTypeForm({
	defaultValues,
	onSubmit,
	mode,
	isPending = false,
	onScrollChange,
}: EventTypeFormProps) {
	// Fetch available booking types
	const { data: bookingTypesData } = useQuery(
		configurationsApi.bookingTypesOptions(),
	);
	const bookingTypes = bookingTypesData?.data ?? [];

	// Extract metadata from default values
	const metadata = defaultValues?.metadata as {
		bookingTypes?: string[];
	} | null;

	const form = useForm<EventTypeFormValues>({
		resolver: zodResolver(eventTypeFormSchema),
		defaultValues: {
			label: "",
			description: "",
			color: "",
			sortOrder: 0,
			isDefault: false,
			applicableBookingTypes: [],
		},
	});

	// Reset form when defaultValues change (edit mode)
	useEffect(() => {
		if (defaultValues) {
			form.reset({
				label: defaultValues.label,
				description: defaultValues.description ?? "",
				color: defaultValues.color ?? "",
				sortOrder: defaultValues.sortOrder,
				isDefault: defaultValues.isDefault,
				applicableBookingTypes: metadata?.bookingTypes ?? [],
			});
		}
	}, [defaultValues, form, metadata]);

	const isSubmitting = form.formState.isSubmitting || isPending;

	const handleScroll = useCallback(
		(event: React.UIEvent<HTMLDivElement>) => {
			const target = event.target as HTMLDivElement;
			const isScrolled = target.scrollTop > 0;
			onScrollChange?.(isScrolled);
		},
		[onScrollChange],
	);

	// Handle checkbox toggle for booking types
	const handleBookingTypeToggle = (
		bookingTypeKey: string,
		checked: boolean,
	) => {
		const currentTypes = form.getValues("applicableBookingTypes") ?? [];
		if (checked) {
			form.setValue(
				"applicableBookingTypes",
				[...currentTypes, bookingTypeKey],
				{
					shouldDirty: true,
				},
			);
		} else {
			form.setValue(
				"applicableBookingTypes",
				currentTypes.filter((t) => t !== bookingTypeKey),
				{ shouldDirty: true },
			);
		}
	};

	const selectedBookingTypes = form.watch("applicableBookingTypes") ?? [];

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
										placeholder="e.g., Wedding, Reception, Haldi"
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

						{/* Applicable Booking Types Section */}
						<div className="space-y-3 pt-2">
							<div>
								<h4 className="text-sm font-medium">
									Applicable Booking Types
								</h4>
								<p className="text-xs text-muted-foreground">
									Select which booking types this event
									applies to
								</p>
							</div>

							{bookingTypes.length === 0 ? (
								<Card className="border-dashed">
									<CardContent className="py-4 text-center text-sm text-muted-foreground">
										No booking types configured yet. Add
										booking types in the Configurations
										section first.
									</CardContent>
								</Card>
							) : (
								<Card>
									<CardContent className="py-3">
										<div className="grid grid-cols-2 gap-3">
											{bookingTypes.map((bookingType) => {
												const isChecked =
													selectedBookingTypes.includes(
														bookingType.key,
													);
												return (
													<div
														key={bookingType.key}
														className="flex items-center space-x-2"
													>
														<Checkbox
															id={`booking-type-${bookingType.key}`}
															checked={isChecked}
															onCheckedChange={(
																checked,
															) =>
																handleBookingTypeToggle(
																	bookingType.key,
																	checked ===
																		true,
																)
															}
														/>
														<Label
															htmlFor={`booking-type-${bookingType.key}`}
															className="text-sm font-normal cursor-pointer"
														>
															{bookingType.label}
														</Label>
													</div>
												);
											})}
										</div>
										{selectedBookingTypes.length === 0 && (
											<p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
												No booking types selected — this
												event type will be available for
												all booking types
											</p>
										)}
									</CardContent>
								</Card>
							)}
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
												placeholder="Optional description for this event type"
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
													Pre-select this event type
													in forms
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
						mode === "edit" ? "Save Changes" : "Create Event Type"
					}
				/>
			</div>
		</form>
	);
}
