"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Shoot } from "@repo/api/modules/studio/schemas/shoot";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@repo/ui/components/field";
import { DatePicker } from "@repo/ui/components/date-picker";
import { Input } from "@repo/ui/components/input";
import { TimePicker } from "@repo/ui/components/time-picker";
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

const shootFormSchema = z.object({
	bookingId: z.string().min(1, "Booking is required"),
	name: z.string().min(1, "Name is required").max(255),
	shootType: z.string().min(1, "Shoot type is required").max(100),
	shootDate: z.string().min(1, "Shoot date is required"),
	startTime: z.string().optional().or(z.literal("")),
	endTime: z.string().optional().or(z.literal("")),
	venue: z.string().max(255).optional().or(z.literal("")),
	venueAddress: z.string().max(500).optional().or(z.literal("")),
	notes: z.string().max(5000).optional().or(z.literal("")),
});

export type ShootFormValues = z.infer<typeof shootFormSchema>;

const SHOOT_TYPES = [
	{ value: "pre_wedding", label: "Pre Wedding" },
	{ value: "wedding", label: "Wedding" },
	{ value: "engagement", label: "Engagement" },
	{ value: "mehendi", label: "Mehendi" },
	{ value: "sangeet", label: "Sangeet" },
	{ value: "haldi", label: "Haldi" },
	{ value: "portrait", label: "Portrait" },
	{ value: "maternity", label: "Maternity" },
	{ value: "baby_shoot", label: "Baby Shoot" },
	{ value: "corporate", label: "Corporate" },
	{ value: "other", label: "Other" },
];

interface ShootFormProps {
	defaultValues?: Shoot;
	defaultBookingId?: string;
	onSubmit: (data: ShootFormValues) => Promise<void>;
	mode: "create" | "edit";
	isPending?: boolean;
	onScrollChange?: (isScrolled: boolean) => void;
}

export function ShootForm({
	defaultValues,
	defaultBookingId,
	onSubmit,
	mode,
	isPending = false,
	onScrollChange,
}: ShootFormProps) {
	const { data: bookingsData, isLoading: isLoadingBookings } = useQuery(
		bookingsApi.listMinimalOptions({}),
	);

	const bookings = bookingsData?.data ?? [];

	const form = useForm<ShootFormValues>({
		resolver: zodResolver(shootFormSchema),
		defaultValues: {
			bookingId: defaultBookingId ?? "",
			name: "",
			shootType: "",
			shootDate: "",
			startTime: "",
			endTime: "",
			venue: "",
			venueAddress: "",
			notes: "",
		},
	});

	useEffect(() => {
		if (defaultValues) {
			form.reset({
				bookingId: defaultValues.bookingId,
				name: defaultValues.name,
				shootType: defaultValues.shootType,
				shootDate: defaultValues.shootDate,
				startTime: defaultValues.startTime ?? "",
				endTime: defaultValues.endTime ?? "",
				venue: defaultValues.venue ?? "",
				venueAddress: defaultValues.venueAddress ?? "",
				notes: defaultValues.notes ?? "",
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
										disabled={
											mode === "edit" || isLoadingBookings
										}
									>
										<SelectTrigger
											id={field.name}
											aria-invalid={fieldState.invalid}
										>
											<SelectValue placeholder="Select booking" />
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
										placeholder="Enter shoot name"
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

						<div className="grid grid-cols-2 gap-4">
							<Controller
								name="shootType"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={field.name}>
											Shoot Type *
										</FieldLabel>
										<Select
											onValueChange={field.onChange}
											value={field.value}
										>
											<SelectTrigger
												id={field.name}
												aria-invalid={
													fieldState.invalid
												}
											>
												<SelectValue placeholder="Select type" />
											</SelectTrigger>
											<SelectContent>
												{SHOOT_TYPES.map((type) => (
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

							<Controller
								name="shootDate"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={field.name}>
											Shoot Date *
										</FieldLabel>
										<DatePicker
											value={field.value}
											onValueChange={field.onChange}
											id={field.name}
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
						</div>

						{/* Scheduling & Location (Collapsible) */}
						<CollapsibleSection
							title="Time & Location"
							defaultOpen={mode === "edit"}
						>
							<FieldGroup>
								<div className="grid grid-cols-2 gap-4">
									<Controller
										name="startTime"
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
													Start Time
												</FieldLabel>
												<TimePicker
													value={field.value}
													onValueChange={
														field.onChange
													}
													id={field.name}
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
										name="endTime"
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
													End Time
												</FieldLabel>
												<TimePicker
													value={field.value}
													onValueChange={
														field.onChange
													}
													id={field.name}
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
									name="venue"
									control={form.control}
									render={({ field, fieldState }) => (
										<Field
											data-invalid={fieldState.invalid}
										>
											<FieldLabel htmlFor={field.name}>
												Venue
											</FieldLabel>
											<Input
												{...field}
												id={field.name}
												placeholder="Enter venue name"
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
									name="venueAddress"
									control={form.control}
									render={({ field, fieldState }) => (
										<Field
											data-invalid={fieldState.invalid}
										>
											<FieldLabel htmlFor={field.name}>
												Venue Address
											</FieldLabel>
											<Textarea
												{...field}
												id={field.name}
												placeholder="Enter full address"
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
									name="notes"
									control={form.control}
									render={({ field, fieldState }) => (
										<Field
											data-invalid={fieldState.invalid}
										>
											<FieldLabel htmlFor={field.name}>
												Notes
											</FieldLabel>
											<Textarea
												{...field}
												id={field.name}
												placeholder="Additional notes..."
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
							</FieldGroup>
						</CollapsibleSection>
					</FieldGroup>
				</div>
			</ScrollArea>

			<div className="shrink-0 border-t p-4 bg-background">
				<FormActions
					mode={mode}
					isSubmitting={isSubmitting}
					submitLabel={mode === "edit" ? "Save Changes" : "Add Shoot"}
				/>
			</div>
		</form>
	);
}
