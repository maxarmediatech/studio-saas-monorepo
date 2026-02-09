"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { ReceivedAmountDetail } from "@repo/api/modules/studio/schemas/payment";
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
import { bookingsApi, invoicesApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { FormActions } from "../ui/FormActions";

// ============================================================================
// Constants
// ============================================================================

const PAYMENT_METHODS = [
	{ value: "cash", label: "Cash" },
	{ value: "upi", label: "UPI" },
	{ value: "bank_transfer", label: "Bank Transfer" },
	{ value: "cheque", label: "Cheque" },
	{ value: "card", label: "Card" },
	{ value: "other", label: "Other" },
] as const;

// ============================================================================
// Schema
// ============================================================================

const paymentFormSchema = z.object({
	bookingId: z.string().min(1, "Booking is required"),
	invoiceId: z.string().optional().or(z.literal("")),
	amount: z
		.string()
		.min(1, "Amount is required")
		.regex(/^\d+(\.\d{1,2})?$/, "Must be a valid amount"),
	paymentMethod: z.enum([
		"cash",
		"upi",
		"bank_transfer",
		"cheque",
		"card",
		"other",
	]),
	receivedDate: z.string().min(1, "Date is required"),
	transactionReference: z.string().max(100).optional().or(z.literal("")),
	notes: z.string().max(10000).optional().or(z.literal("")),
});

export type PaymentFormValues = z.infer<typeof paymentFormSchema>;

// ============================================================================
// Types
// ============================================================================

interface BookingInfo {
	id: string;
	name: string;
	referenceNumber: string;
}

interface PaymentFormProps {
	defaultValues?: ReceivedAmountDetail;
	defaultBookingId?: string;
	/** Booking info for edit mode (read-only display) */
	booking?: BookingInfo;
	onSubmit: (data: PaymentFormValues) => Promise<void>;
	mode: "create" | "edit";
	isPending?: boolean;
	onScrollChange?: (isScrolled: boolean) => void;
}

// ============================================================================
// Component
// ============================================================================

export function PaymentForm({
	defaultValues,
	defaultBookingId,
	booking,
	onSubmit,
	mode,
	isPending = false,
	onScrollChange,
}: PaymentFormProps) {
	const [showDetails, setShowDetails] = useState(false);

	// ========================================================================
	// Data Fetching
	// ========================================================================

	const { data: bookingsData, isLoading: isLoadingBookings } = useQuery({
		...bookingsApi.listMinimalOptions({}),
		enabled: mode === "create",
	});
	const bookings = bookingsData?.data ?? [];

	// ========================================================================
	// Form Setup
	// ========================================================================

	const form = useForm<PaymentFormValues>({
		resolver: zodResolver(paymentFormSchema),
		defaultValues: {
			bookingId: defaultBookingId ?? "",
			invoiceId: "",
			amount: "",
			paymentMethod: "upi",
			receivedDate: new Date().toISOString().split("T")[0],
			transactionReference: "",
			notes: "",
		},
	});

	const selectedBookingId = form.watch("bookingId");

	const { data: invoicesData, isLoading: isLoadingInvoices } = useQuery({
		...invoicesApi.listOptions({
			bookingId: selectedBookingId,
			status: ["draft", "sent", "partial", "overdue"],
		}),
		enabled: !!selectedBookingId,
	});
	const unpaidInvoices = invoicesData?.data ?? [];

	// Reset form when defaultValues change (edit mode)
	useEffect(() => {
		if (defaultValues) {
			form.reset({
				bookingId: defaultValues.bookingId,
				amount: defaultValues.amount,
				paymentMethod: defaultValues.paymentMethod,
				receivedDate: defaultValues.receivedDate,
				transactionReference: defaultValues.transactionReference ?? "",
				notes: defaultValues.notes ?? "",
			});

			// Auto-expand details if there's content
			if (defaultValues.transactionReference || defaultValues.notes) {
				setShowDetails(true);
			}
		}
	}, [defaultValues, form]);

	// ========================================================================
	// Computed Values
	// ========================================================================

	const isSubmitting = form.formState.isSubmitting || isPending;
	const transactionRef = form.watch("transactionReference");
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

	const invoiceOptions = useMemo((): ComboboxOption[] => {
		const options: ComboboxOption[] = [
			{ value: "", label: "No invoice (standalone payment)" },
		];

		for (const inv of unpaidInvoices) {
			const remaining =
				Number(inv.totalAmount) - Number(inv.paidAmount ?? 0);
			options.push({
				value: inv.id,
				label: `${inv.invoiceNumber} - ₹${remaining.toFixed(2)} remaining`,
			});
		}

		return options;
	}, [unpaidInvoices]);

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
						{/* Booking - Searchable Combobox */}
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

						{/* Invoice Linking (Optional) */}
						{selectedBookingId && mode === "create" && (
							<Controller
								name="invoiceId"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={field.name}>
											Link to Invoice
										</FieldLabel>
										<Combobox
											id={field.name}
											value={field.value ?? ""}
											onValueChange={field.onChange}
											options={invoiceOptions}
											placeholder={
												isLoadingInvoices
													? "Loading invoices..."
													: "Select invoice (optional)..."
											}
											searchPlaceholder="Search invoices..."
											emptyText="No unpaid invoices for this booking"
											disabled={isLoadingInvoices}
											aria-invalid={fieldState.invalid}
										/>
										<p className="text-xs text-muted-foreground">
											Linking generates a receipt and
											updates invoice payment status
										</p>
										{fieldState.invalid && (
											<FieldError
												errors={[fieldState.error]}
											/>
										)}
									</Field>
								)}
							/>
						)}

						{/* Amount, Payment Method, Date - Main row */}
						<div className="grid grid-cols-3 gap-4">
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
								name="paymentMethod"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={field.name}>
											Method *
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
												<SelectValue placeholder="Select method" />
											</SelectTrigger>
											<SelectContent>
												{PAYMENT_METHODS.map(
													(method) => (
														<SelectItem
															key={method.value}
															value={method.value}
														>
															{method.label}
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
								name="receivedDate"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={field.name}>
											Date *
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

						{/* Additional Details (Collapsible) */}
						{(showDetails || transactionRef || notesValue) && (
							<>
								<Controller
									name="transactionReference"
									control={form.control}
									render={({ field, fieldState }) => (
										<Field
											data-invalid={fieldState.invalid}
										>
											<div className="flex items-center justify-between">
												<FieldLabel
													htmlFor={field.name}
												>
													Transaction Reference
												</FieldLabel>
												{showDetails &&
													!transactionRef &&
													!notesValue && (
														<Button
															type="button"
															variant="ghost"
															size="sm"
															className="h-auto py-0 px-1 text-muted-foreground"
															onClick={() =>
																setShowDetails(
																	false,
																)
															}
														>
															<ChevronUpIcon className="mr-1 h-3.5 w-3.5" />
															Hide
														</Button>
													)}
											</div>
											<Input
												{...field}
												id={field.name}
												placeholder="Transaction ID or reference number"
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
												placeholder="Additional notes about this payment"
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
							</>
						)}

						{!showDetails && !transactionRef && !notesValue && (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="w-fit text-muted-foreground"
								onClick={() => setShowDetails(true)}
							>
								<ChevronDownIcon className="mr-1.5 h-3.5 w-3.5" />
								Additional details
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
						mode === "edit" ? "Save Changes" : "Record Payment"
					}
				/>
			</div>
		</form>
	);
}
