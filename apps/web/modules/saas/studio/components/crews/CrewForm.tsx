"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Crew } from "@repo/api/modules/studio/schemas/crew";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from "@repo/ui/components/input-group";
import { MultiSelectCombobox } from "@repo/ui/components/multi-select-combobox";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { configurationsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { CollapsibleSection } from "../ui/CollapsibleSection";
import { FormActions } from "../ui/FormActions";

const crewFormSchema = z.object({
	name: z.string().min(1, "Name is required").max(255),
	email: z.string().email("Invalid email").optional().or(z.literal("")),
	phoneNumber: z
		.string()
		.min(10, "Phone number must be at least 10 digits")
		.optional()
		.or(z.literal("")),
	specializations: z.array(z.string().min(1).max(100)).default([]),
	status: z.string().min(1, "Status is required"),
	dailyRate: z.string().optional().or(z.literal("")),
});

type CrewFormInputValues = z.input<typeof crewFormSchema>;
export type CrewFormValues = z.output<typeof crewFormSchema>;

const CREW_STATUSES = [
	{ value: "active", label: "Active" },
	{ value: "inactive", label: "Inactive" },
	{ value: "unavailable", label: "Unavailable" },
];

interface CrewFormProps {
	defaultValues?: Crew;
	onSubmit: (data: CrewFormValues) => Promise<void>;
	mode: "create" | "edit";
	isPending?: boolean;
	onScrollChange?: (isScrolled: boolean) => void;
}

export function CrewForm({
	defaultValues,
	onSubmit,
	mode,
	isPending = false,
	onScrollChange,
}: CrewFormProps) {
	const form = useForm<CrewFormInputValues>({
		resolver: zodResolver(crewFormSchema),
		defaultValues: {
			name: "",
			email: "",
			phoneNumber: "",
			specializations: [],
			status: "active",
			dailyRate: "",
		},
	});

	const { data: specializationOptionsData } = useQuery(
		configurationsApi.specialisationsOptions(),
	);
	const specializationOptions =
		specializationOptionsData?.data?.map((item) => ({
			value: item.key,
			label: item.label,
		})) ?? [];

	useEffect(() => {
		if (defaultValues) {
			form.reset({
				name: defaultValues.name,
				email: defaultValues.email ?? "",
				phoneNumber: defaultValues.phoneNumber ?? "",
				specializations: defaultValues.specializations ?? [],
				status: defaultValues.status,
				dailyRate: defaultValues.dailyRate ?? "",
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
			onSubmit={form.handleSubmit((values) =>
				onSubmit(crewFormSchema.parse(values)),
			)}
			className="flex flex-col h-full min-h-0"
		>
			<ScrollArea
				className="flex-1 min-h-0"
				onScrollCapture={handleScroll}
			>
				<div className="px-4 py-4">
					<FieldGroup>
						{/* Essential Fields */}
						<Controller
							name="name"
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor={field.name}>
										Name *
									</FieldLabel>
									<Input
										{...field}
										id={field.name}
										placeholder="Enter name"
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

						<Controller
							name="specializations"
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor={field.name}>
										Specialisations
									</FieldLabel>
									<MultiSelectCombobox
										options={specializationOptions}
										value={field.value ?? []}
										onValueChange={field.onChange}
										id={field.name}
										aria-invalid={fieldState.invalid}
										placeholder="Select specialisations"
										searchPlaceholder="Search specialisations..."
										emptyText="No specialisation found."
									/>
									{fieldState.invalid && (
										<FieldError
											errors={[fieldState.error]}
										/>
									)}
								</Field>
							)}
						/>

						{/* Advanced Options (Collapsible) */}
						<CollapsibleSection
							title="Contact & Details"
							defaultOpen={mode === "edit"}
						>
							<FieldGroup>
								<div className="grid grid-cols-2 gap-4">
									<Controller
										name="email"
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
													Email
												</FieldLabel>
												<Input
													{...field}
													id={field.name}
													type="email"
													placeholder="email@example.com"
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
										name="phoneNumber"
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
													Phone
												</FieldLabel>
												<Input
													{...field}
													id={field.name}
													placeholder="+91 9876543210"
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

								<div className="grid grid-cols-2 gap-4">
									<Controller
										name="status"
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
													Status *
												</FieldLabel>
												<Select
													onValueChange={
														field.onChange
													}
													value={field.value}
												>
													<SelectTrigger
														id={field.name}
														aria-invalid={
															fieldState.invalid
														}
													>
														<SelectValue placeholder="Select status" />
													</SelectTrigger>
													<SelectContent>
														{CREW_STATUSES.map(
															(status) => (
																<SelectItem
																	key={
																		status.value
																	}
																	value={
																		status.value
																	}
																>
																	{
																		status.label
																	}
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
										name="dailyRate"
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
													Daily Rate (INR)
												</FieldLabel>
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
														placeholder="5000"
														aria-invalid={
															fieldState.invalid
														}
													/>
												</InputGroup>
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
						</CollapsibleSection>
					</FieldGroup>
				</div>
			</ScrollArea>

			<div className="shrink-0 border-t p-4 bg-background">
				<FormActions
					mode={mode}
					isSubmitting={isSubmitting}
					submitLabel={
						mode === "edit" ? "Save Changes" : "Add Member"
					}
				/>
			</div>
		</form>
	);
}
