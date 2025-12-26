"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { Button } from "@repo/ui/components/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Loader2Icon } from "lucide-react";
import { bookingsApi } from "@saas/studio/lib/api";
import type { ReceivedAmountDetail } from "@repo/api/modules/studio/schemas/payment";

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
	onSubmit: (data: PaymentFormValues) => Promise<void>;
	mode: "create" | "edit";
	isPending?: boolean;
}

export function PaymentForm({
	defaultValues,
	onSubmit,
	mode,
	isPending = false,
}: PaymentFormProps) {
	const form = useForm<PaymentFormValues>({
		resolver: zodResolver(paymentFormSchema),
		defaultValues: {
			bookingId: "",
			amount: "",
			paymentMethod: "upi",
			receivedDate: new Date().toISOString().split("T")[0],
			transactionReference: "",
			notes: "",
		},
	});

	// Fetch bookings for dropdown (listMinimal returns 100 items sorted by createdAt desc)
	const { data: bookingsData, isLoading: bookingsLoading } = useQuery(
		bookingsApi.listMinimalOptions({})
	);

	const bookings = bookingsData?.data ?? [];

	// Reset form when defaultValues change (for edit mode)
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

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				<FormField
					control={form.control}
					name="bookingId"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Booking *</FormLabel>
							<Select
								onValueChange={field.onChange}
								value={field.value}
								disabled={mode === "edit"}
							>
								<FormControl>
									<SelectTrigger>
										<SelectValue placeholder="Select booking" />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									{bookingsLoading ? (
										<SelectItem value="loading" disabled>
											Loading bookings...
										</SelectItem>
									) : bookings.length === 0 ? (
										<SelectItem value="none" disabled>
											No bookings found
										</SelectItem>
									) : (
										bookings.map((booking) => (
											<SelectItem key={booking.id} value={booking.id}>
												{booking.name} ({booking.referenceNumber})
											</SelectItem>
										))
									)}
								</SelectContent>
							</Select>
							<FormMessage />
						</FormItem>
					)}
				/>

				<div className="grid grid-cols-2 gap-4">
					<FormField
						control={form.control}
						name="amount"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Amount (INR) *</FormLabel>
								<FormControl>
									<div className="relative">
										<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
											₹
										</span>
										<Input
											placeholder="0.00"
											className="pl-7"
											{...field}
											onChange={(e) => {
												const value = e.target.value.replace(/[^0-9.]/g, "");
												const parts = value.split(".");
												if (parts.length > 2) return;
												if (parts[1] && parts[1].length > 2) return;
												field.onChange(value);
											}}
										/>
									</div>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="paymentMethod"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Payment Method *</FormLabel>
								<Select onValueChange={field.onChange} value={field.value}>
									<FormControl>
										<SelectTrigger>
											<SelectValue placeholder="Select method" />
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										{PAYMENT_METHODS.map((method) => (
											<SelectItem key={method.value} value={method.value}>
												{method.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>

				<div className="grid grid-cols-2 gap-4">
					<FormField
						control={form.control}
						name="receivedDate"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Date Received *</FormLabel>
								<FormControl>
									<Input type="date" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="transactionReference"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Transaction Reference</FormLabel>
								<FormControl>
									<Input placeholder="Transaction ID or reference" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>

				<FormField
					control={form.control}
					name="notes"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Notes</FormLabel>
							<FormControl>
								<Textarea
									placeholder="Additional notes"
									className="resize-none"
									rows={3}
									{...field}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<div className="flex justify-end pt-4">
					<Button type="submit" disabled={isSubmitting}>
						{isSubmitting && (
							<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
						)}
						{mode === "edit" ? "Save Changes" : "Add Payment"}
					</Button>
				</div>
			</form>
		</Form>
	);
}
