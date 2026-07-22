"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Crew } from "@repo/api/modules/studio/schemas/crew";
import { FieldGroup } from "@repo/ui/components/field";
import {
	CustomField,
	SelectField,
	TextField,
} from "@repo/ui/components/form-fields";
import { FieldRow, FormSection } from "@repo/ui/components/form-section";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from "@repo/ui/components/input-group";
import { MultiSelectCombobox } from "@repo/ui/components/multi-select-combobox";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { configurationsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
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
						<FormSection>
							<TextField
								control={form.control}
								name="name"
								label="Name"
								placeholder="Enter name"
								required
							/>

							<CustomField
								control={form.control}
								name="specializations"
								label="Specialisations"
							>
								{({ field, fieldState }) => (
									<MultiSelectCombobox
										options={specializationOptions}
										value={field.value ?? []}
										onValueChange={field.onChange}
										id={field.name}
										aria-invalid={fieldState.invalid}
										placeholder="Select specialisations"
										searchPlaceholder="Search specialisations..."
										emptyText="No specialisation found."
										className="h-8 px-2.5 text-13"
									/>
								)}
							</CustomField>
						</FormSection>

						{/* Advanced Options (Collapsible) */}
						<CollapsibleSection
							title="Contact & Details"
							defaultOpen={mode === "edit"}
						>
							<FormSection>
								<FieldRow>
									<TextField
										control={form.control}
										name="email"
										label="Email"
										type="email"
										placeholder="email@example.com"
									/>

									<TextField
										control={form.control}
										name="phoneNumber"
										label="Phone"
										placeholder="+91 9876543210"
									/>
								</FieldRow>

								<FieldRow>
									<SelectField
										control={form.control}
										name="status"
										label="Status"
										placeholder="Select status"
										options={CREW_STATUSES}
										required
									/>

									<CustomField
										control={form.control}
										name="dailyRate"
										label="Daily Rate (INR)"
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
													size="sm"
													type="number"
													placeholder="5000"
													aria-invalid={
														fieldState.invalid
													}
												/>
											</InputGroup>
										)}
									</CustomField>
								</FieldRow>
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
						mode === "edit" ? "Save Changes" : "Add Member"
					}
				/>
			</div>
		</form>
	);
}
