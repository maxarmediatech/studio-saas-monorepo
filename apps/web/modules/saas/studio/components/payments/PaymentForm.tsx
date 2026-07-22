"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { ReceivedAmountDetail } from "@repo/api/modules/studio/schemas/payment";
import { Button } from "@repo/ui/components/button";
import { Combobox, type ComboboxOption } from "@repo/ui/components/combobox";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@repo/ui/components/field";
import {
	CustomField,
	DateField,
	SelectField,
	TextareaField,
} from "@repo/ui/components/form-fields";
import { FieldRow, FormSection } from "@repo/ui/components/form-section";
import { Input } from "@repo/ui/components/input";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from "@repo/ui/components/input-group";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { Textarea } from "@repo/ui/components/textarea";
import { useStudioCapabilities } from "@saas/studio/components/studio-capabilities-context";
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
	correctionReason: z.string().max(1000).optional().or(z.literal("")),
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
	mode: "create" | "edit" | "correct";
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
	const { bookingReadOrReference } = useStudioCapabilities();

	// ========================================================================
	// Data Fetching
	// ========================================================================

	const { data: bookingsData, isLoading: isLoadingBookings } = useQuery({
		...bookingsApi.listMinimalOptions({}),
		enabled: mode === "create" && bookingReadOrReference,
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
			correctionReason: "",
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
				correctionReason: "",
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
	const areFinancialDetailsLocked =
		mode === "edit" &&
		defaultValues?.financialProtection.canEditFinancialDetails === false;
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
						{mode === "correct" && (
							<FormSection>
								<Controller
									name="correctionReason"
									control={form.control}
									rules={{
										required:
											"Explain why this payment is being corrected",
										minLength: {
											value: 5,
											message:
												"Please provide a little more detail",
										},
									}}
									render={({ field, fieldState }) => (
										<Field
											data-invalid={fieldState.invalid}
										>
											<FieldLabel
												variant="micro"
												htmlFor={field.name}
											>
												Reason for correction *
											</FieldLabel>
											<Textarea
												{...field}
												id={field.name}
												size="sm"
												rows={3}
												placeholder="For example: amount entered incorrectly from the bank statement"
											/>
											<p className="text-xs text-muted-foreground">
												The original payment and receipt
												will be preserved as reversed. A
												new receipt will be issued for
												the corrected payment.
											</p>
											{fieldState.invalid && (
												<FieldError
													errors={[fieldState.error]}
												/>
											)}
										</Field>
									)}
								/>
							</FormSection>
						)}

						<FormSection>
							{/* Booking - Searchable Combobox */}
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
										className="h-8 px-2.5 text-13"
									/>
								)}
							</CustomField>

							{/* Invoice Linking (Optional) */}
							{selectedBookingId && mode === "create" && (
								<CustomField
									control={form.control}
									name="invoiceId"
									label="Link to Invoice"
									description="Linking generates a receipt and updates invoice payment status"
								>
									{({ field, fieldState }) => (
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
											className="h-8 px-2.5 text-13"
										/>
									)}
								</CustomField>
							)}
						</FormSection>

						{/* Amount, Payment Method, Date - Main row */}
						<FormSection>
							<FieldRow cols={3}>
								<CustomField
									control={form.control}
									name="amount"
									label="Amount"
									required
								>
									{({ field, fieldState }) => (
										<>
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
													placeholder="0.00"
													disabled={
														areFinancialDetailsLocked
													}
													aria-describedby={
														areFinancialDetailsLocked
															? "payment-financial-details-lock-reason"
															: undefined
													}
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
											{areFinancialDetailsLocked && (
												<p
													id="payment-financial-details-lock-reason"
													className="text-xs text-muted-foreground"
												>
													Amount, method, and date are
													locked because this payment
													is already applied. Notes
													and reference can still be
													updated.
												</p>
											)}
										</>
									)}
								</CustomField>

								<SelectField
									control={form.control}
									name="paymentMethod"
									label="Method"
									required
									placeholder="Select method"
									disabled={areFinancialDetailsLocked}
									options={PAYMENT_METHODS.map((method) => ({
										value: method.value,
										label: method.label,
									}))}
								/>

								<DateField
									control={form.control}
									name="receivedDate"
									label="Date"
									required
									disabled={areFinancialDetailsLocked}
								/>
							</FieldRow>
						</FormSection>

						{/* Additional Details (Collapsible) */}
						{(showDetails || transactionRef || notesValue) && (
							<FormSection>
								<CustomField
									control={form.control}
									name="transactionReference"
								>
									{({ field, fieldState }) => (
										<>
											<div className="flex items-center justify-between">
												<FieldLabel
													variant="micro"
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
												size="sm"
												placeholder="Transaction ID or reference number"
												aria-invalid={
													fieldState.invalid
												}
											/>
										</>
									)}
								</CustomField>

								<TextareaField
									control={form.control}
									name="notes"
									label="Notes"
									placeholder="Additional notes about this payment"
									rows={2}
								/>
							</FormSection>
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
					mode={mode === "create" ? "create" : "edit"}
					isSubmitting={isSubmitting}
					submitLabel={
						mode === "correct"
							? "Reverse & Create Replacement"
							: mode === "edit"
								? "Save Changes"
								: "Record Payment"
					}
				/>
			</div>
		</form>
	);
}
