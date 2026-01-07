"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { ReceivedAmountDetail } from "@repo/api/modules/studio/schemas/payment";
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

const PAYMENT_METHODS = [
	{ value: "cash", label: "Cash" },
	{ value: "upi", label: "UPI" },
	{ value: "bank_transfer", label: "Bank Transfer" },
	{ value: "cheque", label: "Cheque" },
	{ value: "card", label: "Card" },
	{ value: "other", label: "Other" },
] as const;

const paymentFormSchema = z.object({
	bookingId: z.string().min(1, "Booking is required"),
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

interface PaymentFormProps {
	defaultValues?: ReceivedAmountDetail;
	defaultBookingId?: string;
	onSubmit: (data: PaymentFormValues) => Promise<void>;
	mode: "create" | "edit";
	isPending?: boolean;
	onScrollChange?: (isScrolled: boolean) => void;
}

export function PaymentForm({
	defaultValues,
	defaultBookingId,
	onSubmit,
	mode,
	isPending = false,
	onScrollChange,
}: PaymentFormProps) {
	const form = useForm<PaymentFormValues>({
		resolver: zodResolver(paymentFormSchema),
		defaultValues: {
			bookingId: defaultBookingId ?? "",
			amount: "",
			paymentMethod: "upi",
			receivedDate: new Date().toISOString().split("T")[0],
			transactionReference: "",
			notes: "",
		},
	});

	const { data: bookingsData, isLoading: bookingsLoading } = useQuery(
		bookingsApi.listMinimalOptions({}),
	);

	const bookings = bookingsData?.data ?? [];

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
											<SelectValue placeholder="Select booking" />
										</SelectTrigger>
										<SelectContent>
											{bookingsLoading ? (
												<SelectItem
													value="loading"
													disabled
												>
													Loading bookings...
												</SelectItem>
											) : bookings.length === 0 ? (
												<SelectItem
													value="none"
													disabled
												>
													No bookings found
												</SelectItem>
											) : (
												bookings.map((booking) => (
													<SelectItem
														key={booking.id}
														value={booking.id}
													>
														{booking.name} (
														{
															booking.referenceNumber
														}
														)
													</SelectItem>
												))
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

						<div className="grid grid-cols-2 gap-4">
							<Controller
								name="amount"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={field.name}>
											Amount (INR) *
										</FieldLabel>
										<div className="relative">
											<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
												Rs.
											</span>
											<Input
												{...field}
												id={field.name}
												placeholder="0.00"
												className="pl-10"
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
								name="paymentMethod"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={field.name}>
											Payment Method *
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
						</div>

						{/* Additional Details (Collapsible) */}
						<CollapsibleSection
							title="Additional Details"
							defaultOpen={mode === "edit"}
						>
							<FieldGroup>
								<div className="grid grid-cols-2 gap-4">
									<Controller
										name="receivedDate"
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
													Date Received *
												</FieldLabel>
												<DatePicker
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
										name="transactionReference"
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
													Transaction Reference
												</FieldLabel>
												<Input
													{...field}
													id={field.name}
													placeholder="Transaction ID or reference"
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
												placeholder="Additional notes"
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
					submitLabel={
						mode === "edit" ? "Save Changes" : "Add Payment"
					}
				/>
			</div>
		</form>
	);
}
