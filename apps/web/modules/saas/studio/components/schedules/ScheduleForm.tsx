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
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from "@repo/ui/components/input-group";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Textarea } from "@repo/ui/components/textarea";
import { formatMoney } from "@saas/shared/lib";
import { PAYMENT_SCHEDULE_PRESETS } from "@saas/studio/components/bookings/booking-form";
import { useStudioCapabilities } from "@saas/studio/components/studio-capabilities-context";
import { bookingsApi, studioPaymentsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { FormActions } from "../ui/FormActions";

const taxTypeOptions = [
	{ value: "exclusive", label: "Exclusive (add GST)" },
	{ value: "inclusive", label: "Inclusive (GST included)" },
	{ value: "no_gst", label: "No GST" },
] as const;

const scheduleFormSchema = z.object({
	bookingId: z.string().min(1, "Booking is required"),
	name: z.string().min(1, "Schedule name is required").max(100),
	amount: z
		.string()
		.min(1, "Amount is required")
		.regex(/^\d+(\.\d{1,2})?$/, "Must be a valid amount"),
	dueDate: z.string().min(1, "Due date is required"),
	taxType: z.enum(["exclusive", "inclusive", "no_gst"]),
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

function moneyToCents(value: string | undefined | null): number {
	const [whole = "0", fraction = ""] = (value ?? "0").split(".");
	const fractionPadded = `${fraction}00`.slice(0, 2);
	return Number(whole) * 100 + Number(fractionPadded);
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
	const { bookingReadOrList, bookingReadOrReference } =
		useStudioCapabilities();

	const { data: bookingsData, isLoading: isLoadingBookings } = useQuery({
		...bookingsApi.listMinimalOptions({}),
		enabled: mode === "create" && bookingReadOrReference,
	});
	const bookings = bookingsData?.data ?? [];

	const form = useForm<ScheduleFormValues>({
		resolver: zodResolver(scheduleFormSchema),
		defaultValues: {
			bookingId: defaultBookingId ?? "",
			name: "",
			amount: "",
			dueDate: new Date().toISOString().split("T")[0],
			taxType: "no_gst",
			notes: "",
		},
	});
	const selectedBookingId = form.watch("bookingId");

	const { data: selectedBookingData, isLoading: isLoadingSelectedBooking } =
		useQuery({
			...bookingsApi.getOptions(selectedBookingId),
			enabled:
				mode === "create" && bookingReadOrList && !!selectedBookingId,
		});

	const { data: paymentStatsData, isLoading: isLoadingPaymentStats } =
		useQuery({
			...studioPaymentsApi.statsOptions({
				bookingId: selectedBookingId || undefined,
			}),
			enabled: mode === "create" && !!selectedBookingId,
		});

	useEffect(() => {
		if (defaultValues) {
			form.reset({
				bookingId: defaultValues.bookingId,
				name: defaultValues.name,
				amount: defaultValues.amount,
				dueDate: defaultValues.dueDate ?? "",
				taxType: defaultValues.taxType ?? "no_gst",
				notes: defaultValues.notes ?? "",
			});

			if (defaultValues.notes) {
				setShowNotes(true);
			}
		}
	}, [defaultValues, form]);

	const notesValue = form.watch("notes");
	const amountValue = form.watch("amount");
	const leftToScheduleCents = useMemo(() => {
		if (mode !== "create" || !selectedBookingId) {
			return null;
		}

		const bookingDetail = selectedBookingData?.data;
		const paymentStats = paymentStatsData?.data;

		if (!bookingDetail || !paymentStats) {
			return null;
		}

		const packageCostCents = moneyToCents(bookingDetail.packageCost);
		const totalReceivedCents = moneyToCents(bookingDetail.totalReceived);
		const totalPendingCents = moneyToCents(paymentStats.totalPending);

		return Math.max(
			packageCostCents - totalReceivedCents - totalPendingCents,
			0,
		);
	}, [
		mode,
		selectedBookingId,
		selectedBookingData?.data,
		paymentStatsData?.data,
	]);
	const isRemainingLoading =
		mode === "create" &&
		!!selectedBookingId &&
		(isLoadingSelectedBooking || isLoadingPaymentStats);
	const showLeftToSchedule =
		mode === "create" &&
		!!selectedBookingId &&
		!isRemainingLoading &&
		leftToScheduleCents !== null;
	const leftToScheduleDisplay =
		leftToScheduleCents !== null
			? formatMoney((leftToScheduleCents / 100).toFixed(2))
			: null;
	const isScheduleAmountExhausted =
		showLeftToSchedule &&
		leftToScheduleCents !== null &&
		leftToScheduleCents <= 0;
	const isScheduleAmountLoading =
		mode === "create" && !!selectedBookingId && isRemainingLoading;
	const isSubmitting =
		form.formState.isSubmitting ||
		isPending ||
		isScheduleAmountExhausted ||
		isScheduleAmountLoading;

	useEffect(() => {
		if (form.formState.errors.amount?.type === "manual") {
			form.clearErrors("amount");
		}
	}, [amountValue, selectedBookingId, leftToScheduleCents, form]);

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

	const handleSubmit = useCallback(
		async (data: ScheduleFormValues) => {
			if (mode === "create" && selectedBookingId && isRemainingLoading) {
				form.setError("amount", {
					type: "manual",
					message:
						"Please wait while we calculate amount left to schedule",
				});
				return;
			}

			if (mode === "create" && leftToScheduleCents !== null) {
				if (leftToScheduleCents <= 0) {
					form.setError("amount", {
						type: "manual",
						message: "No amount left to schedule for this booking",
					});
					return;
				}

				const amountCents = moneyToCents(data.amount);
				if (amountCents > leftToScheduleCents) {
					form.setError("amount", {
						type: "manual",
						message: `Amount cannot exceed left to schedule (${formatMoney((leftToScheduleCents / 100).toFixed(2))})`,
					});
					return;
				}
			}

			await onSubmit(data);
		},
		[
			isRemainingLoading,
			leftToScheduleCents,
			mode,
			selectedBookingId,
			form,
			onSubmit,
		],
	);

	return (
		<form
			onSubmit={form.handleSubmit(handleSubmit)}
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
									{isRemainingLoading && (
										<p className="text-xs text-muted-foreground">
											Checking amount left to schedule...
										</p>
									)}
									{showLeftToSchedule &&
										leftToScheduleDisplay && (
											<p
												className={`text-xs ${isScheduleAmountExhausted ? "text-destructive" : "text-muted-foreground"}`}
											>
												Left to schedule:{" "}
												<span className="font-medium">
													{leftToScheduleDisplay}
												</span>
											</p>
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
										list="schedule-name-presets"
										autoComplete="off"
										aria-invalid={fieldState.invalid}
									/>
									<datalist id="schedule-name-presets">
										{PAYMENT_SCHEDULE_PRESETS.map(
											(preset) => (
												<option
													key={preset.value}
													value={preset.label}
												/>
											),
										)}
									</datalist>
									{fieldState.invalid && (
										<FieldError
											errors={[fieldState.error]}
										/>
									)}
								</Field>
							)}
						/>

						<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
							<Controller
								name="amount"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={field.name}>
											Amount *
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
												placeholder="0.00"
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
										</InputGroup>
										{fieldState.invalid && (
											<FieldError
												errors={[fieldState.error]}
											/>
										)}
									</Field>
								)}
							/>

							<Controller
								name="taxType"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={field.name}>
											GST Type *
										</FieldLabel>
										<Select
											value={field.value}
											onValueChange={field.onChange}
										>
											<SelectTrigger
												id={field.name}
												aria-invalid={
													fieldState.invalid
												}
											>
												<SelectValue placeholder="Select GST type" />
											</SelectTrigger>
											<SelectContent>
												{taxTypeOptions.map(
													(option) => (
														<SelectItem
															key={option.value}
															value={option.value}
														>
															{option.label}
														</SelectItem>
													),
												)}
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
