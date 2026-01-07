"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { DeliverableDetail } from "@repo/api/modules/studio/schemas/deliverable";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@repo/ui/components/field";
import { DatePicker } from "@repo/ui/components/date-picker";
import { Input } from "@repo/ui/components/input";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Textarea } from "@repo/ui/components/textarea";
import { bookingsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { CollapsibleSection } from "../ui/CollapsibleSection";
import { FormActions } from "../ui/FormActions";

const DELIVERABLE_TYPES = [
	{ value: "wedding_album", label: "Wedding Album" },
	{ value: "pre_wedding_album", label: "Pre-Wedding Album" },
	{ value: "photo_album", label: "Photo Album" },
	{ value: "highlight_video", label: "Highlight Video" },
	{ value: "full_video", label: "Full Video" },
	{ value: "teaser", label: "Teaser" },
	{ value: "reel", label: "Reel" },
	{ value: "edited_photos", label: "Edited Photos" },
	{ value: "raw_photos", label: "Raw Photos" },
	{ value: "raw_videos", label: "Raw Videos" },
	{ value: "drone_footage", label: "Drone Footage" },
	{ value: "frame", label: "Frame" },
	{ value: "canvas", label: "Canvas" },
	{ value: "other", label: "Other" },
] as const;

const deliverableFormSchema = z.object({
	bookingId: z.string().min(1, "Booking is required"),
	name: z.string().min(1, "Name is required").max(255),
	deliverableType: z.string().min(1, "Type is required"),
	description: z.string().max(5000).optional().or(z.literal("")),
	dueDate: z.string().optional().or(z.literal("")),
	status: z.string().max(50).optional().or(z.literal("")),
	priority: z.string().max(50).optional().or(z.literal("")),
});

export type DeliverableFormValues = z.infer<typeof deliverableFormSchema>;

interface DeliverableFormProps {
	defaultValues?: DeliverableDetail;
	defaultBookingId?: string;
	onSubmit: (data: DeliverableFormValues) => Promise<void>;
	mode: "create" | "edit";
	isPending?: boolean;
	onScrollChange?: (isScrolled: boolean) => void;
}

export function DeliverableForm({
	defaultValues,
	defaultBookingId,
	onSubmit,
	mode,
	isPending = false,
	onScrollChange,
}: DeliverableFormProps) {
	const form = useForm<DeliverableFormValues>({
		resolver: zodResolver(deliverableFormSchema),
		defaultValues: {
			bookingId: defaultBookingId ?? "",
			name: "",
			deliverableType: "",
			description: "",
			dueDate: "",
			status: "",
			priority: "",
		},
	});

	const { data: bookingsData, isLoading: isLoadingBookings } = useQuery(
		bookingsApi.listMinimalOptions({}),
	);

	const bookings = bookingsData?.data ?? [];

	useEffect(() => {
		if (defaultValues) {
			form.reset({
				bookingId: defaultValues.bookingId,
				name: defaultValues.name,
				deliverableType: defaultValues.deliverableType,
				description: defaultValues.description ?? "",
				dueDate: defaultValues.dueDate?.split("T")[0] ?? "",
				status: defaultValues.status ?? "",
				priority: defaultValues.priority ?? "",
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
						{/* Essential Fields */}
						<Controller
							name="bookingId"
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor={field.name}>
										Booking *
									</FieldLabel>
									<Select
										onValueChange={field.onChange}
										value={field.value}
										disabled={mode === "edit"}
									>
										<SelectTrigger
											id={field.name}
											aria-invalid={fieldState.invalid}
										>
											<SelectValue
												placeholder={
													isLoadingBookings
														? "Loading..."
														: "Select a booking"
												}
											/>
										</SelectTrigger>
										<SelectContent>
											{bookings.map((booking) => (
												<SelectItem
													key={booking.id}
													value={booking.id}
												>
													{booking.name} (
													{booking.referenceNumber})
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									{fieldState.invalid && (
										<FieldError
											errors={[fieldState.error]}
										/>
									)}
								</Field>
							)}
						/>

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
										placeholder="Enter deliverable name"
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
							name="deliverableType"
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor={field.name}>
										Type *
									</FieldLabel>
									<Select
										onValueChange={field.onChange}
										value={field.value}
									>
										<SelectTrigger
											id={field.name}
											aria-invalid={fieldState.invalid}
										>
											<SelectValue placeholder="Select type" />
										</SelectTrigger>
										<SelectContent>
											{DELIVERABLE_TYPES.map((type) => (
												<SelectItem
													key={type.value}
													value={type.value}
												>
													{type.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									{fieldState.invalid && (
										<FieldError
											errors={[fieldState.error]}
										/>
									)}
								</Field>
							)}
						/>

						{/* Additional Details (Collapsible) */}
						<CollapsibleSection
							title="Additional Details"
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
												placeholder="Enter description"
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

								<Controller
									name="dueDate"
									control={form.control}
									render={({ field, fieldState }) => (
										<Field
											data-invalid={fieldState.invalid}
										>
											<FieldLabel htmlFor={field.name}>
												Due Date
											</FieldLabel>
											<DatePicker
												value={field.value}
												onValueChange={field.onChange}
												id={field.name}
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
													Status
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
														<SelectItem value="pending">
															Pending
														</SelectItem>
														<SelectItem value="in_progress">
															In Progress
														</SelectItem>
														<SelectItem value="completed">
															Completed
														</SelectItem>
														<SelectItem value="delivered">
															Delivered
														</SelectItem>
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
										name="priority"
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
													Priority
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
														<SelectValue placeholder="Select priority" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="low">
															Low
														</SelectItem>
														<SelectItem value="medium">
															Medium
														</SelectItem>
														<SelectItem value="high">
															High
														</SelectItem>
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
						mode === "edit" ? "Save Changes" : "Add Deliverable"
					}
				/>
			</div>
		</form>
	);
}
