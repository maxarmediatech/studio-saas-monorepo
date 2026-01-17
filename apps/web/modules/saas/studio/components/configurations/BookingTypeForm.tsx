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

const bookingTypeFormSchema = z.object({
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
	applicableRoles: z.array(z.string()).optional(),
});

export type BookingTypeFormValues = z.infer<typeof bookingTypeFormSchema>;

interface BookingTypeFormProps {
	defaultValues?: Configuration;
	onSubmit: (data: BookingTypeFormValues) => Promise<void>;
	mode: "create" | "edit";
	isPending?: boolean;
	onScrollChange?: (isScrolled: boolean) => void;
}

export function BookingTypeForm({
	defaultValues,
	onSubmit,
	mode,
	isPending = false,
	onScrollChange,
}: BookingTypeFormProps) {
	// Fetch available relation types (roles)
	const { data: relationTypesData } = useQuery(
		configurationsApi.relationTypesOptions(),
	);
	const relationTypes = relationTypesData?.data ?? [];

	// Extract metadata from default values
	const metadata = defaultValues?.metadata as {
		roles?: string[];
	} | null;

	const form = useForm<BookingTypeFormValues>({
		resolver: zodResolver(bookingTypeFormSchema),
		defaultValues: {
			label: "",
			description: "",
			color: "",
			sortOrder: 0,
			isDefault: false,
			applicableRoles: [],
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
				applicableRoles: metadata?.roles ?? [],
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

	// Handle checkbox toggle for roles
	const handleRoleToggle = (roleKey: string, checked: boolean) => {
		const currentRoles = form.getValues("applicableRoles") ?? [];
		if (checked) {
			form.setValue("applicableRoles", [...currentRoles, roleKey], {
				shouldDirty: true,
			});
		} else {
			form.setValue(
				"applicableRoles",
				currentRoles.filter((r) => r !== roleKey),
				{ shouldDirty: true },
			);
		}
	};

	const selectedRoles = form.watch("applicableRoles") ?? [];

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
										placeholder="e.g., Wedding, Corporate Event"
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

						{/* Applicable Roles Section */}
						<div className="space-y-3 pt-2">
							<div>
								<h4 className="text-sm font-medium">
									Applicable Roles
								</h4>
								<p className="text-xs text-muted-foreground">
									Select which client roles are valid for this
									booking type
								</p>
							</div>

							{relationTypes.length === 0 ? (
								<Card className="border-dashed">
									<CardContent className="py-4 text-center text-sm text-muted-foreground">
										No roles configured yet. Add relation
										types in the Configurations section
										first.
									</CardContent>
								</Card>
							) : (
								<Card>
									<CardContent className="py-3">
										<div className="grid grid-cols-2 gap-3">
											{relationTypes.map((role) => {
												const isChecked =
													selectedRoles.includes(
														role.key,
													);
												return (
													<div
														key={role.key}
														className="flex items-center space-x-2"
													>
														<Checkbox
															id={`role-${role.key}`}
															checked={isChecked}
															onCheckedChange={(
																checked,
															) =>
																handleRoleToggle(
																	role.key,
																	checked ===
																		true,
																)
															}
														/>
														<Label
															htmlFor={`role-${role.key}`}
															className="text-sm font-normal cursor-pointer"
														>
															{role.label}
														</Label>
													</div>
												);
											})}
										</div>
										{selectedRoles.length === 0 && (
											<p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
												No roles selected — all roles
												will be available for this
												booking type
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
												placeholder="Optional description for this booking type"
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
													Pre-select this booking type
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
						mode === "edit" ? "Save Changes" : "Create Booking Type"
					}
				/>
			</div>
		</form>
	);
}
