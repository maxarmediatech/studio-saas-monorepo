"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { PaymentScheduleDetail } from "@repo/api/modules/studio/schemas/payment";
import { Button } from "@repo/ui/components/button";
import { Combobox, type ComboboxOption } from "@repo/ui/components/combobox";
import { DatePicker } from "@repo/ui/components/date-picker";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { Textarea } from "@repo/ui/components/textarea";
import { bookingsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { FormActions } from "../ui/FormActions";

const scheduleFormSchema = z.object({
	bookingId: z.string().min(1, "Booking is required"),
	name: z.string().min(1, "Schedule name is required").max(100),
	amount: z
		.string()
		.min(1, "Amount is required")
		.regex(/^\d+(\.\d{1,2})?$/, "Must be a valid amount"),
	dueDate: z.string().min(1, "Due date is required"),
	notes: z.string().max(10000).optional().or(z.literal("")),
});

export type ScheduleFormValues = z.infer<typeof scheduleFormSchema>;

interface BookingInfo {
	id: string;
	name: string;
	referenceNumber: string;
}

interface ScheduleFormProps {
	defaultValues?: PaymentScheduleDetail;
	defaultBookingId?: string;
	booking?: BookingInfo;
	onSubmit: (data: ScheduleFormValues) => Promise<void>;
	mode: "create" | "edit";
	isPending?: boolean;
	onScrollChange?: (isScrolled: boolean) => void;
}

export function ScheduleForm({
	defaultValues,
	defaultBookingId,
	booking,
	onSubmit,
	mode,
	isPending = false,
	onScrollChange,
}: ScheduleFormProps) {
	const [showNotes, setShowNotes] = useState(false);

	const { data: bookingsData, isLoading: isLoadingBookings } = useQuery({
		...bookingsApi.listMinimalOptions({}),
		enabled: mode === "create",
	});
	const bookings = bookingsData?.data ?? [];

	const form = useForm<ScheduleFormValues>({
		resolver: zodResolver(scheduleFormSchema),
		defaultValues: {
			bookingId: defaultBookingId ?? "",
			name: "",
			amount: "",
			dueDate: new Date().toISOString().split("T")[0],
			notes: "",
		},
	});

	useEffect(() => {
		if (defaultValues) {
			form.reset({
				bookingId: defaultValues.bookingId,
				name: defaultValues.name,
				amount: defaultValues.amount,
				dueDate: defaultValues.dueDate,
				notes: defaultValues.notes ?? "",
			});

			if (defaultValues.notes) {
				setShowNotes(true);
			}
		}
	}, [defaultValues, form]);

	const isSubmitting = form.formState.isSubmitting || isPending;
	const notesValue = form.watch("notes");

	const bookingOptions = useMemo((): ComboboxOption[] => {
		const options = bookings.map((b) => ({
			value: b.id,
			label: `${b.name} (${b.referenceNumber})`,
		}));

		if (booking && !options.some((o) => o.value === booking.id)) {
			options.unshift({
				value: booking.id,
				label: `${booking.name} (${booking.referenceNumber})`,
			});
		}

		return options;
	}, [bookings, booking]);

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
							name="bookingId"
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor={field.name}>
										Booking {mode === "create" && "*"}
									</FieldLabel>
									<Combobox
										id={field.name}
										value={field.value}
										onValueChange={field.onChange}
										options={bookingOptions}
										placeholder={
											isLoadingBookings
												? "Loading..."
												: "Select booking..."
										}
										searchPlaceholder="Search bookings..."
										emptyText="No bookings found"
										disabled={
											mode === "edit" || isLoadingBookings
										}
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
							name="name"
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor={field.name}>
										Schedule Name *
									</FieldLabel>
									<Input
										{...field}
										id={field.name}
										placeholder="e.g., Advance, Before Wedding, Final Payment"
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
								name="amount"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={field.name}>
											Amount *
										</FieldLabel>
										<div className="relative">
											<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
												₹
											</span>
											<Input
												{...field}
												id={field.name}
												placeholder="0.00"
												className="pl-7"
												aria-invalid={
													fieldState.invalid
												}
												onChange={(e) => {
													const value =
														e.target.value.replace(
															/[^0-9.]/g,
															"",
														);
													const parts =
														value.split(".");
													if (parts.length > 2) {
														return;
													}
													if (
														parts[1] &&
														parts[1].length > 2
													) {
														return;
													}
													field.onChange(value);
												}}
											/>
										</div>
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
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={field.name}>
											Due Date *
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

						{(showNotes || notesValue) && (
							<Controller
								name="notes"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<div className="flex items-center justify-between">
											<FieldLabel htmlFor={field.name}>
												Notes
											</FieldLabel>
											{showNotes && !notesValue && (
												<Button
													type="button"
													variant="ghost"
													size="sm"
													className="h-auto py-0 px-1 text-muted-foreground"
													onClick={() =>
														setShowNotes(false)
													}
												>
													<ChevronUpIcon className="mr-1 h-3.5 w-3.5" />
													Hide
												</Button>
											)}
										</div>
										<Textarea
											{...field}
											id={field.name}
											placeholder="Additional notes about this payment schedule"
											className="resize-none"
											rows={2}
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
						)}

						{!showNotes && !notesValue && (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="w-fit text-muted-foreground"
								onClick={() => setShowNotes(true)}
							>
								<ChevronDownIcon className="mr-1.5 h-3.5 w-3.5" />
								Add notes
							</Button>
						)}
					</FieldGroup>
				</div>
			</ScrollArea>

			<div className="shrink-0 border-t p-4 bg-background">
				<FormActions
					mode={mode}
					isSubmitting={isSubmitting}
					submitLabel={
						mode === "edit" ? "Save Changes" : "Add Schedule"
					}
				/>
			</div>
		</form>
	);
}
