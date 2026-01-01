"use client";

import { useMemo } from "react";
import { useFieldArray, useFormContext, Controller } from "react-hook-form";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldSet,
	FieldSeparator,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Textarea } from "@repo/ui/components/textarea";
import { Badge } from "@repo/ui/components/badge";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import {
	BanknoteIcon,
	CalendarIcon,
	PlusIcon,
	TrashIcon,
	WalletIcon,
	AlertCircleIcon,
	CheckCircle2Icon,
} from "lucide-react";
import {
	type BookingFormValues,
	PAYMENT_METHOD_OPTIONS,
	PAYMENT_SCHEDULE_PRESETS,
} from "./booking-form-schema";

export function BookingPaymentsStep() {
	const form = useFormContext<BookingFormValues>();

	const packageCost = form.watch("packageCost");
	const payments = form.watch("payments") ?? [];
	const paymentSchedules = form.watch("paymentSchedules") ?? [];
	const deliverables = form.watch("deliverables") ?? [];

	// Calculate totals including custom deliverable costs
	const { totalCost, totalReceived, totalScheduled, balance, isOverpaid, isFullyPaid } =
		useMemo(() => {
			const pkgCost = parseFloat(packageCost) || 0;
			// Sum costs from custom (non-package) deliverables
			const deliverableCosts = deliverables.reduce((sum, d) => {
				if (d.isPackageIncluded) return sum; // Package deliverables have no additional cost
				return sum + (parseFloat(d.cost ?? "") || 0);
			}, 0);
			const totalCostValue = pkgCost + deliverableCosts;

			const received = payments.reduce(
				(sum, p) => sum + (parseFloat(p.amount) || 0),
				0,
			);
			const scheduled = paymentSchedules.reduce(
				(sum, p) => sum + (parseFloat(p.amount) || 0),
				0,
			);
			const remaining = totalCostValue - received;

			return {
				totalCost: totalCostValue,
				totalReceived: received,
				totalScheduled: scheduled,
				balance: remaining,
				isOverpaid: received > totalCostValue,
				isFullyPaid: received >= totalCostValue,
			};
		}, [packageCost, payments, paymentSchedules, deliverables]);

	const {
		fields: paymentFields,
		append: appendPayment,
		remove: removePayment,
	} = useFieldArray({
		control: form.control,
		name: "payments",
	});

	const {
		fields: scheduleFields,
		append: appendSchedule,
		remove: removeSchedule,
	} = useFieldArray({
		control: form.control,
		name: "paymentSchedules",
	});

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-IN", {
			style: "currency",
			currency: "INR",
			maximumFractionDigits: 0,
		}).format(amount);
	};

	return (
		<FieldGroup className="gap-6">
			{/* Payment Summary */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<WalletIcon className="h-5 w-5" />
						Payment Summary
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 grid-cols-2 md:grid-cols-4">
						<div className="p-4 bg-muted/50 rounded-lg">
							<p className="text-sm text-muted-foreground">Total Cost</p>
							<p className="text-xl md:text-2xl font-bold">
								{formatCurrency(totalCost)}
							</p>
						</div>
						<div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
							<p className="text-sm text-muted-foreground">Total Received</p>
							<p className="text-xl md:text-2xl font-bold text-green-600 dark:text-green-400">
								{formatCurrency(totalReceived)}
							</p>
						</div>
						<div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
							<p className="text-sm text-muted-foreground">Scheduled</p>
							<p className="text-xl md:text-2xl font-bold text-blue-600 dark:text-blue-400">
								{formatCurrency(totalScheduled)}
							</p>
						</div>
						<div
							className={`p-4 rounded-lg ${
								isFullyPaid
									? "bg-green-50 dark:bg-green-950/30"
									: "bg-amber-50 dark:bg-amber-950/30"
							}`}
						>
							<p className="text-sm text-muted-foreground">Balance</p>
							<p
								className={`text-xl md:text-2xl font-bold ${
									isFullyPaid
										? "text-green-600 dark:text-green-400"
										: "text-amber-600 dark:text-amber-400"
								}`}
							>
								{formatCurrency(Math.max(0, balance))}
							</p>
						</div>
					</div>

					{/* Payment status alerts - announced to screen readers */}
					<div aria-live="polite" aria-atomic="true">
						{isOverpaid && (
							<Alert variant="destructive" className="mt-4" role="alert">
								<AlertCircleIcon className="h-4 w-4" />
								<AlertDescription>
									Total payments exceed the package cost by{" "}
									{formatCurrency(Math.abs(balance))}.
								</AlertDescription>
							</Alert>
						)}

						{isFullyPaid && !isOverpaid && (
							<Alert className="mt-4 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30" role="status">
								<CheckCircle2Icon className="h-4 w-4 text-green-600" />
								<AlertDescription className="text-green-600 dark:text-green-400">
									Payment complete! All dues have been received.
								</AlertDescription>
							</Alert>
						)}
					</div>
				</CardContent>
			</Card>

			{/* Received Payments */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							<BanknoteIcon className="h-5 w-5" />
							Received Payments
						</CardTitle>
						<p className="text-sm text-muted-foreground mt-1">
							Record payments already received from the client
						</p>
					</div>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() =>
							appendPayment({
								amount: "",
								paymentMethod: "upi",
								receivedDate: new Date().toISOString().split("T")[0],
								transactionReference: "",
								notes: "",
							})
						}
					>
						<PlusIcon className="mr-2 h-4 w-4" />
						Add Payment
					</Button>
				</CardHeader>
				<CardContent>
					<FieldSet>
						{paymentFields.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-12 text-center border border-dashed rounded-lg">
								<BanknoteIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
								<p className="text-sm text-muted-foreground mb-4">
									No payments recorded yet. Click "Add Payment" to record
									received amounts.
								</p>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() =>
										appendPayment({
											amount: "",
											paymentMethod: "upi",
											receivedDate: new Date().toISOString().split("T")[0],
											transactionReference: "",
											notes: "",
										})
									}
								>
									<PlusIcon className="mr-2 h-4 w-4" />
									Add Payment
								</Button>
							</div>
						) : (
							<FieldGroup className="gap-4">
								{paymentFields.map((payment, index) => (
									<Card key={payment.id} className="p-4">
										<div className="flex flex-col md:flex-row md:items-start gap-4">
											<div className="flex-1 grid gap-4 grid-cols-2 md:grid-cols-5">
												{/* Amount */}
												<Controller
													name={`payments.${index}.amount`}
													control={form.control}
													render={({ field, fieldState }) => (
														<Field data-invalid={fieldState.invalid}>
															<FieldLabel htmlFor={field.name}>
																Amount
															</FieldLabel>
															<div className="relative">
																<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
																	₹
																</span>
																<Input
																	{...field}
																	id={field.name}
																	className="pl-7"
																	placeholder="0.00"
																	aria-invalid={fieldState.invalid}
																	onChange={(e) => {
																		const value = e.target.value.replace(
																			/[^0-9.]/g,
																			"",
																		);
																		const parts = value.split(".");
																		if (parts.length > 2) return;
																		if (parts[1] && parts[1].length > 2) return;
																		field.onChange(value);
																	}}
																/>
															</div>
															{fieldState.invalid && (
																<FieldError errors={[fieldState.error]} />
															)}
														</Field>
													)}
												/>

												{/* Payment Method */}
												<Controller
													name={`payments.${index}.paymentMethod`}
													control={form.control}
													render={({ field, fieldState }) => (
														<Field data-invalid={fieldState.invalid}>
															<FieldLabel htmlFor={field.name}>
																Method
															</FieldLabel>
															<Select
																onValueChange={field.onChange}
																value={field.value}
															>
																<SelectTrigger
																	id={field.name}
																	aria-invalid={fieldState.invalid}
																>
																	<SelectValue placeholder="Select" />
																</SelectTrigger>
																<SelectContent>
																	{PAYMENT_METHOD_OPTIONS.map((method) => (
																		<SelectItem
																			key={method.value}
																			value={method.value}
																		>
																			{method.label}
																		</SelectItem>
																	))}
																</SelectContent>
															</Select>
															{fieldState.invalid && (
																<FieldError errors={[fieldState.error]} />
															)}
														</Field>
													)}
												/>

												{/* Received Date */}
												<Controller
													name={`payments.${index}.receivedDate`}
													control={form.control}
													render={({ field, fieldState }) => (
														<Field data-invalid={fieldState.invalid}>
															<FieldLabel htmlFor={field.name}>Date</FieldLabel>
															<Input
																{...field}
																id={field.name}
																type="date"
																aria-invalid={fieldState.invalid}
															/>
															{fieldState.invalid && (
																<FieldError errors={[fieldState.error]} />
															)}
														</Field>
													)}
												/>

												{/* Transaction Reference */}
												<Controller
													name={`payments.${index}.transactionReference`}
													control={form.control}
													render={({ field, fieldState }) => (
														<Field data-invalid={fieldState.invalid}>
															<FieldLabel htmlFor={field.name}>
																Reference
															</FieldLabel>
															<Input
																{...field}
																id={field.name}
																placeholder="Transaction ID"
																aria-invalid={fieldState.invalid}
															/>
															{fieldState.invalid && (
																<FieldError errors={[fieldState.error]} />
															)}
														</Field>
													)}
												/>

												{/* Notes */}
												<Controller
													name={`payments.${index}.notes`}
													control={form.control}
													render={({ field, fieldState }) => (
														<Field data-invalid={fieldState.invalid}>
															<FieldLabel htmlFor={field.name}>
																Notes
															</FieldLabel>
															<Input
																{...field}
																id={field.name}
																placeholder="Optional notes"
																aria-invalid={fieldState.invalid}
															/>
															{fieldState.invalid && (
																<FieldError errors={[fieldState.error]} />
															)}
														</Field>
													)}
												/>
											</div>

											{/* Remove Button - 44px touch target (WCAG 2.5.5) */}
											<Button
												type="button"
												variant="ghost"
												size="icon"
												className="self-end md:self-auto md:mt-8 min-h-11 min-w-11 text-destructive hover:text-destructive hover:bg-destructive/10"
												onClick={() => removePayment(index)}
											>
												<TrashIcon className="h-4 w-4" />
												<span className="sr-only">Remove payment</span>
											</Button>
										</div>
									</Card>
								))}
							</FieldGroup>
						)}
					</FieldSet>
				</CardContent>
			</Card>

			{/* Payment Schedule */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							<CalendarIcon className="h-5 w-5" />
							Payment Schedule
						</CardTitle>
						<p className="text-sm text-muted-foreground mt-1">
							Plan upcoming payment milestones
						</p>
					</div>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() =>
							appendSchedule({
								name: "",
								amount: "",
								dueDate: "",
								notes: "",
							})
						}
					>
						<PlusIcon className="mr-2 h-4 w-4" />
						Add Milestone
					</Button>
				</CardHeader>
				<CardContent>
					<FieldSet>
						{scheduleFields.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-12 text-center border border-dashed rounded-lg">
								<CalendarIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
								<p className="text-sm text-muted-foreground mb-4">
									No payment schedule set. Click "Add Milestone" to plan payment
									dates.
								</p>
								{/* Quick add presets */}
								<div className="flex flex-wrap gap-2 justify-center">
									{PAYMENT_SCHEDULE_PRESETS.slice(0, 3).map((preset) => (
										<Button
											key={preset.value}
											type="button"
											variant="outline"
											size="sm"
											onClick={() =>
												appendSchedule({
													name: preset.label,
													amount: "",
													dueDate: "",
													notes: "",
												})
											}
										>
											<PlusIcon className="mr-1 h-3 w-3" />
											{preset.label}
										</Button>
									))}
								</div>
							</div>
						) : (
							<FieldGroup className="gap-4">
								{scheduleFields.map((schedule, index) => (
									<Card key={schedule.id} className="p-4">
										<div className="flex flex-col md:flex-row md:items-start gap-4">
											<div className="flex-1 grid gap-4 grid-cols-2 md:grid-cols-4">
												{/* Name */}
												<Controller
													name={`paymentSchedules.${index}.name`}
													control={form.control}
													render={({ field, fieldState }) => (
														<Field data-invalid={fieldState.invalid}>
															<FieldLabel htmlFor={field.name}>
																Payment Name
															</FieldLabel>
															<Input
																{...field}
																id={field.name}
																placeholder="e.g. Advance Payment"
																list={`schedule-presets-${index}`}
																aria-invalid={fieldState.invalid}
															/>
															<datalist id={`schedule-presets-${index}`}>
																{PAYMENT_SCHEDULE_PRESETS.map((preset) => (
																	<option
																		key={preset.value}
																		value={preset.label}
																	/>
																))}
															</datalist>
															{fieldState.invalid && (
																<FieldError errors={[fieldState.error]} />
															)}
														</Field>
													)}
												/>

												{/* Amount */}
												<Controller
													name={`paymentSchedules.${index}.amount`}
													control={form.control}
													render={({ field, fieldState }) => (
														<Field data-invalid={fieldState.invalid}>
															<FieldLabel htmlFor={field.name}>
																Amount
															</FieldLabel>
															<div className="relative">
																<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
																	₹
																</span>
																<Input
																	{...field}
																	id={field.name}
																	className="pl-7"
																	placeholder="0.00"
																	aria-invalid={fieldState.invalid}
																	onChange={(e) => {
																		const value = e.target.value.replace(
																			/[^0-9.]/g,
																			"",
																		);
																		const parts = value.split(".");
																		if (parts.length > 2) return;
																		if (parts[1] && parts[1].length > 2) return;
																		field.onChange(value);
																	}}
																/>
															</div>
															{fieldState.invalid && (
																<FieldError errors={[fieldState.error]} />
															)}
														</Field>
													)}
												/>

												{/* Due Date */}
												<Controller
													name={`paymentSchedules.${index}.dueDate`}
													control={form.control}
													render={({ field, fieldState }) => (
														<Field data-invalid={fieldState.invalid}>
															<FieldLabel htmlFor={field.name}>
																Due Date
															</FieldLabel>
															<Input
																{...field}
																id={field.name}
																type="date"
																aria-invalid={fieldState.invalid}
															/>
															{fieldState.invalid && (
																<FieldError errors={[fieldState.error]} />
															)}
														</Field>
													)}
												/>

												{/* Notes */}
												<Controller
													name={`paymentSchedules.${index}.notes`}
													control={form.control}
													render={({ field, fieldState }) => (
														<Field data-invalid={fieldState.invalid}>
															<FieldLabel htmlFor={field.name}>
																Notes
															</FieldLabel>
															<Input
																{...field}
																id={field.name}
																placeholder="Optional notes"
																aria-invalid={fieldState.invalid}
															/>
															{fieldState.invalid && (
																<FieldError errors={[fieldState.error]} />
															)}
														</Field>
													)}
												/>
											</div>

											{/* Remove Button - 44px touch target (WCAG 2.5.5) */}
											<Button
												type="button"
												variant="ghost"
												size="icon"
												className="self-end md:self-auto md:mt-8 min-h-11 min-w-11 text-destructive hover:text-destructive hover:bg-destructive/10"
												onClick={() => removeSchedule(index)}
											>
												<TrashIcon className="h-4 w-4" />
												<span className="sr-only">Remove schedule</span>
											</Button>
										</div>
									</Card>
								))}
							</FieldGroup>
						)}
					</FieldSet>
				</CardContent>
			</Card>
		</FieldGroup>
	);
}
