"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { TaskDetail } from "@repo/api/modules/studio/schemas/task";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { Badge } from "@repo/ui/components/badge";

import { Combobox, type ComboboxOption } from "@repo/ui/components/combobox";
import { FieldGroup } from "@repo/ui/components/field";
import {
	CustomField,
	DateField,
	SelectField,
	TextareaField,
	TextField,
} from "@repo/ui/components/form-fields";
import { FieldRow, FormSection } from "@repo/ui/components/form-section";
import { MultiSelectCombobox } from "@repo/ui/components/multi-select-combobox";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { useAllCrewOptions } from "@saas/studio/components/shared";
import { useStudioCapabilities } from "@saas/studio/components/studio-capabilities-context";
import { bookingsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormActions } from "../ui/FormActions";

// ============================================================================
// Helpers
// ============================================================================

function getInitials(name: string): string {
	return name
		.split(" ")
		.map((part) => part[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
}

// ============================================================================
// Schema
// ============================================================================

const crewAssignmentSchema = z.object({
	crewId: z.string().min(1, "Crew member is required"),
});

const taskFormSchema = z.object({
	bookingId: z.string().min(1, "Booking is required"),
	name: z.string().min(1, "Name is required").max(255),
	description: z.string().max(5000).optional().or(z.literal("")),
	status: z.string().max(50).optional().or(z.literal("")),
	priority: z.string().max(50).optional().or(z.literal("")),
	dueDate: z.string().optional().or(z.literal("")),
	crewAssignments: z.array(crewAssignmentSchema).optional(),
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;

// ============================================================================
// Types
// ============================================================================

interface BookingInfo {
	id: string;
	name: string;
	referenceNumber: string;
}

interface CrewOption {
	value: string;
	label: string;
}

interface TaskFormProps {
	defaultValues?: TaskDetail;
	defaultBookingId?: string;
	booking?: BookingInfo;
	existingAssignments?: Array<{
		crewId: string;
		crew: { id: string; name: string };
	}>;
	onSubmit: (data: TaskFormValues) => Promise<void>;
	mode: "create" | "edit";
	isPending?: boolean;
	onScrollChange?: (isScrolled: boolean) => void;
}

// ============================================================================
// Component
// ============================================================================

export function TaskForm({
	defaultValues,
	defaultBookingId,
	booking,
	existingAssignments,
	onSubmit,
	mode,
	isPending = false,
	onScrollChange,
}: TaskFormProps) {
	const { bookingReadOrReference } = useStudioCapabilities();

	// ========================================================================
	// Data Fetching
	// ========================================================================

	const { data: bookingsData, isLoading: bookingsLoading } = useQuery({
		...bookingsApi.listMinimalOptions({}),
		enabled: mode === "create" && bookingReadOrReference,
	});
	const bookings = bookingsData?.data ?? [];

	const { data: crews = [] } = useAllCrewOptions();

	// ========================================================================
	// Form Setup
	// ========================================================================

	const form = useForm<TaskFormValues>({
		resolver: zodResolver(taskFormSchema),
		defaultValues: {
			bookingId: defaultBookingId ?? "",
			name: "",
			description: "",
			status: "",
			priority: "",
			dueDate: "",
			crewAssignments: [],
		},
	});

	// Reset form when defaultValues change (edit mode)
	useEffect(() => {
		if (defaultValues) {
			const assignments =
				existingAssignments?.map((a) => ({
					crewId: a.crewId,
				})) ?? [];

			form.reset({
				bookingId: defaultValues.bookingId,
				name: defaultValues.name,
				description: defaultValues.description ?? "",
				status: defaultValues.status ?? "",
				priority: defaultValues.priority ?? "",
				dueDate: defaultValues.dueDate?.split("T")[0] ?? "",
				crewAssignments: assignments,
			});
		}
	}, [defaultValues, existingAssignments, form]);

	// ========================================================================
	// Computed Values
	// ========================================================================

	const isSubmitting = form.formState.isSubmitting || isPending;

	const bookingOptions = useMemo((): ComboboxOption[] => {
		const options = bookings.map((b) => ({
			value: b.id,
			label: `${b.name} (${b.referenceNumber})`,
		}));

		// Include current booking in edit mode even if not in list
		if (booking && !options.some((o) => o.value === booking.id)) {
			options.unshift({
				value: booking.id,
				label: `${booking.name} (${booking.referenceNumber})`,
			});
		}

		return options;
	}, [bookings, booking]);

	const crewOptions: CrewOption[] = useMemo(
		() =>
			crews.map((crew) => ({
				value: crew.id,
				label: crew.name,
			})),
		[crews],
	);

	// ========================================================================
	// Handlers
	// ========================================================================

	const handleScroll = useCallback(
		(event: React.UIEvent<HTMLDivElement>) => {
			const target = event.target as HTMLDivElement;
			const isScrolled = target.scrollTop > 0;
			onScrollChange?.(isScrolled);
		},
		[onScrollChange],
	);

	// ========================================================================
	// Render
	// ========================================================================

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
							<CustomField
								control={form.control}
								name="bookingId"
								label="Booking"
								required={mode === "create"}
							>
								{({ field, fieldState }) => (
									<Combobox
										id={field.name}
										value={field.value}
										onValueChange={field.onChange}
										options={bookingOptions}
										placeholder={
											bookingsLoading
												? "Loading..."
												: "Select booking..."
										}
										searchPlaceholder="Search bookings..."
										emptyText="No bookings found"
										disabled={
											mode === "edit" || bookingsLoading
										}
										aria-invalid={fieldState.invalid}
										className="h-8 px-2.5 text-13"
									/>
								)}
							</CustomField>

							<TextField
								control={form.control}
								name="name"
								label="Name"
								required
								placeholder="Enter task name"
								autoComplete="off"
							/>
						</FormSection>

						<FormSection>
							<FieldRow cols={3}>
								<SelectField
									control={form.control}
									name="status"
									label="Status"
									placeholder="Select status"
									options={[
										{ value: "pending", label: "Pending" },
										{
											value: "in_progress",
											label: "In Progress",
										},
										{
											value: "completed",
											label: "Completed",
										},
										{
											value: "cancelled",
											label: "Cancelled",
										},
									]}
								/>

								<SelectField
									control={form.control}
									name="priority"
									label="Priority"
									placeholder="Select priority"
									options={[
										{ value: "low", label: "Low" },
										{ value: "normal", label: "Normal" },
										{ value: "medium", label: "Medium" },
										{ value: "high", label: "High" },
									]}
								/>

								<DateField
									control={form.control}
									name="dueDate"
									label="Due Date"
								/>
							</FieldRow>
						</FormSection>

						<FormSection>
							<CustomField
								control={form.control}
								name="crewAssignments"
								label="Assigned Team"
							>
								{({ field }) => {
									const selectedIds = (field.value ?? []).map(
										(a) => a.crewId,
									);

									return (
										<MultiSelectCombobox
											options={crewOptions}
											value={selectedIds}
											onValueChange={(ids) => {
												field.onChange(
													ids.map((id) => ({
														crewId: id,
													})),
												);
											}}
											placeholder="Select team members..."
											searchPlaceholder="Search team..."
											emptyText="No team members found"
											className="min-h-8 px-2.5 text-13"
											renderOption={(option) => (
												<div className="flex items-center gap-2">
													<Avatar className="h-6 w-6">
														<AvatarFallback className="text-[10px]">
															{getInitials(
																option.label,
															)}
														</AvatarFallback>
													</Avatar>
													<span>{option.label}</span>
												</div>
											)}
											renderSelectedItem={(
												option,
												onRemove,
											) => (
												<Badge
													variant="secondary"
													className="flex items-center gap-1.5 pr-1"
												>
													<Avatar className="h-4 w-4">
														<AvatarFallback className="text-[8px]">
															{getInitials(
																option.label,
															)}
														</AvatarFallback>
													</Avatar>
													<span className="truncate">
														{option.label}
													</span>
													<button
														type="button"
														onClick={(e) => {
															e.stopPropagation();
															onRemove();
														}}
														className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
													>
														<XIcon className="size-3" />
														<span className="sr-only">
															Remove{" "}
															{option.label}
														</span>
													</button>
												</Badge>
											)}
										/>
									);
								}}
							</CustomField>
						</FormSection>

						<FormSection>
							<TextareaField
								control={form.control}
								name="description"
								label="Description"
								placeholder="Enter task description"
								rows={2}
							/>
						</FormSection>
					</FieldGroup>
				</div>
			</ScrollArea>

			<div className="shrink-0 border-t p-4 bg-background">
				<FormActions
					mode={mode}
					isSubmitting={isSubmitting}
					submitLabel={mode === "edit" ? "Save Changes" : "Add Task"}
				/>
			</div>
		</form>
	);
}
