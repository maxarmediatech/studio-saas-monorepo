"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Expense } from "@repo/api/modules/studio/schemas/expense";
import { Button } from "@repo/ui/components/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Textarea } from "@repo/ui/components/textarea";
import { Loader2Icon } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const expenseFormSchema = z.object({
	description: z.string().min(1, "Description is required").max(500),
	amount: z
		.string()
		.min(1, "Amount is required")
		.regex(/^\d+(\.\d{1,2})?$/, "Must be a valid amount (e.g., '1500.00')"),
	category: z.string().max(100).optional().or(z.literal("")),
	expenseDate: z.string().min(1, "Date is required"),
	billTo: z.enum(["studio", "client"]).optional(),
	paymentMethod: z
		.enum(["cash", "upi", "bank_transfer", "cheque", "card", "other"])
		.optional(),
	vendor: z.string().max(255).optional().or(z.literal("")),
	transactionReference: z.string().max(100).optional().or(z.literal("")),
	notes: z.string().max(10000).optional().or(z.literal("")),
});

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

interface ExpenseFormProps {
	defaultValues?: Expense;
	onSubmit: (data: ExpenseFormValues) => Promise<void>;
	mode: "create" | "edit";
	isPending?: boolean;
}

const PAYMENT_METHODS = [
	{ value: "cash", label: "Cash" },
	{ value: "upi", label: "UPI" },
	{ value: "bank_transfer", label: "Bank Transfer" },
	{ value: "cheque", label: "Cheque" },
	{ value: "card", label: "Card" },
	{ value: "other", label: "Other" },
] as const;

const BILL_TO_OPTIONS = [
	{ value: "studio", label: "Studio" },
	{ value: "client", label: "Client" },
] as const;

export function ExpenseForm({
	defaultValues,
	onSubmit,
	mode,
	isPending = false,
}: ExpenseFormProps) {
	const form = useForm<ExpenseFormValues>({
		resolver: zodResolver(expenseFormSchema),
		defaultValues: {
			description: "",
			amount: "",
			category: "",
			expenseDate: new Date().toISOString().split("T")[0],
			billTo: "studio",
			paymentMethod: undefined,
			vendor: "",
			transactionReference: "",
			notes: "",
		},
	});

	// Reset form when defaultValues change (for edit mode)
	useEffect(() => {
		if (defaultValues) {
			form.reset({
				description: defaultValues.description,
				amount: defaultValues.amount,
				category: defaultValues.category ?? "",
				expenseDate: defaultValues.expenseDate,
				billTo: defaultValues.billTo ?? "studio",
				paymentMethod: defaultValues.paymentMethod ?? undefined,
				vendor: defaultValues.vendor ?? "",
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
					name="description"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Description *</FormLabel>
							<FormControl>
								<Input
									placeholder="Enter expense description"
									{...field}
								/>
							</FormControl>
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
								<FormLabel>Amount *</FormLabel>
								<FormControl>
									<div className="relative">
										<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
											Rs.
										</span>
										<Input
											placeholder="1500.00"
											className="pl-10"
											{...field}
										/>
									</div>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="expenseDate"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Date *</FormLabel>
								<FormControl>
									<Input type="date" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>

				<div className="grid grid-cols-2 gap-4">
					<FormField
						control={form.control}
						name="category"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Category</FormLabel>
								<FormControl>
									<Input
										placeholder="e.g., Equipment, Travel"
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="vendor"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Vendor</FormLabel>
								<FormControl>
									<Input
										placeholder="Vendor name"
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>

				<div className="grid grid-cols-2 gap-4">
					<FormField
						control={form.control}
						name="billTo"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Bill To</FormLabel>
								<Select
									onValueChange={field.onChange}
									value={field.value}
								>
									<FormControl>
										<SelectTrigger>
											<SelectValue placeholder="Select bill to" />
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										{BILL_TO_OPTIONS.map((option) => (
											<SelectItem
												key={option.value}
												value={option.value}
											>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="paymentMethod"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Payment Method</FormLabel>
								<Select
									onValueChange={field.onChange}
									value={field.value}
								>
									<FormControl>
										<SelectTrigger>
											<SelectValue placeholder="Select method" />
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										{PAYMENT_METHODS.map((method) => (
											<SelectItem
												key={method.value}
												value={method.value}
											>
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

				<FormField
					control={form.control}
					name="transactionReference"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Transaction Reference</FormLabel>
							<FormControl>
								<Input
									placeholder="e.g., Invoice #, UPI ID"
									{...field}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="notes"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Notes</FormLabel>
							<FormControl>
								<Textarea
									placeholder="Additional notes..."
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
						{mode === "edit" ? "Save Changes" : "Add Expense"}
					</Button>
				</div>
			</form>
		</Form>
	);
}
