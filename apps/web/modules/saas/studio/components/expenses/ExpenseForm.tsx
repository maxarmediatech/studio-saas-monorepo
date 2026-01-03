"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Expense } from "@repo/api/modules/studio/schemas/expense";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@repo/ui/components/field";
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
import { useCallback, useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { CollapsibleSection } from "../ui/CollapsibleSection";
import { FormActions } from "../ui/FormActions";

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
	onScrollChange?: (isScrolled: boolean) => void;
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
	onScrollChange,
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
							name="description"
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor={field.name}>
										Description *
									</FieldLabel>
									<Input
										{...field}
										id={field.name}
										placeholder="Enter expense description"
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
												Rs.
											</span>
											<Input
												{...field}
												id={field.name}
												placeholder="1500.00"
												className="pl-10"
												aria-invalid={
													fieldState.invalid
												}
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
								name="expenseDate"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={field.name}>
											Date *
										</FieldLabel>
										<Input
											{...field}
											id={field.name}
											type="date"
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
						<CollapsibleSection
							title="Additional Details"
							defaultOpen={mode === "edit"}
						>
							<FieldGroup>
								<div className="grid grid-cols-2 gap-4">
									<Controller
										name="category"
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
													Category
												</FieldLabel>
												<Input
													{...field}
													id={field.name}
													placeholder="e.g., Equipment, Travel"
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
										name="vendor"
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
													Vendor
												</FieldLabel>
												<Input
													{...field}
													id={field.name}
													placeholder="Vendor name"
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

								<div className="grid grid-cols-2 gap-4">
									<Controller
										name="billTo"
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
													Bill To
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
														<SelectValue placeholder="Select bill to" />
													</SelectTrigger>
													<SelectContent>
														{BILL_TO_OPTIONS.map(
															(option) => (
																<SelectItem
																	key={
																		option.value
																	}
																	value={
																		option.value
																	}
																>
																	{
																		option.label
																	}
																</SelectItem>
															),
														)}
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
										name="paymentMethod"
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
													Payment Method
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
														<SelectValue placeholder="Select method" />
													</SelectTrigger>
													<SelectContent>
														{PAYMENT_METHODS.map(
															(method) => (
																<SelectItem
																	key={
																		method.value
																	}
																	value={
																		method.value
																	}
																>
																	{
																		method.label
																	}
																</SelectItem>
															),
														)}
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

								<Controller
									name="transactionReference"
									control={form.control}
									render={({ field, fieldState }) => (
										<Field
											data-invalid={fieldState.invalid}
										>
											<FieldLabel htmlFor={field.name}>
												Transaction Reference
											</FieldLabel>
											<Input
												{...field}
												id={field.name}
												placeholder="e.g., Invoice #, UPI ID"
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
					submitLabel={
						mode === "edit" ? "Save Changes" : "Add Expense"
					}
				/>
			</div>
		</form>
	);
}
