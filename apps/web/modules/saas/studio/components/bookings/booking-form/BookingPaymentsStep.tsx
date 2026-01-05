"use client";

import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { DatePicker } from "@repo/ui/components/date-picker";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSeparator,
	FieldSet,
	FieldTitle,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import {
	BanknoteIcon,
	CalendarIcon,
	PlusIcon,
	TrashIcon,
	WalletIcon,
} from "lucide-react";
import { useMemo } from "react";
import { Controller, useFieldArray, useFormContext } from "react-hook-form";
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
	const {
		totalCost,
		totalReceived,
		totalScheduled,
		balance,
		isOverpaid,
		isFullyPaid,
	} = useMemo(() => {
		const pkgCost = Number.parseFloat(packageCost) || 0;
		// Sum costs from custom (non-package) deliverables
		const deliverableCosts = deliverables.reduce((sum, d) => {
			if (d.isPackageIncluded) {
				return sum; // Package deliverables have no additional cost
			}
			return sum + (Number.parseFloat(d.cost ?? "") || 0);
		}, 0);
		const totalCostValue = pkgCost + deliverableCosts;

		const received = payments.reduce(
			(sum, p) => sum + (Number.parseFloat(p.amount) || 0),
			0,
		);
		const scheduled = paymentSchedules.reduce(
			(sum, p) => sum + (Number.parseFloat(p.amount) || 0),
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

	const addNewPayment = () => {
		appendPayment({
			amount: "",
			paymentMethod: "upi",
			receivedDate: new Date().toISOString().split("T")[0],
			transactionReference: "",
			notes: "",
		});
	};

	const addNewSchedule = (presetLabel?: string) => {
		appendSchedule({
			name: presetLabel ?? "",
			amount: "",
			dueDate: "",
			notes: "",
		});
	};

	return (
		<Card className="shadow-none">
			<CardContent>
				<FieldSet>
					<FieldGroup>
						{/* Payment Summary */}
						<Field orientation="responsive">
							<div className="flex-1">
								<FieldLegend className="flex items-center gap-2">
									<WalletIcon className="h-4 w-4" />
									Payment Summary
								</FieldLegend>
								<FieldDescription>
									Track payment progress against total booking
									cost
								</FieldDescription>
							</div>
							<div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-right">
								<div className="text-muted-foreground">
									Total
								</div>
								<div className="font-medium">
									{formatCurrency(totalCost)}
								</div>
								<div className="text-muted-foreground">
									Received
								</div>
								<div className="font-medium text-green-600 dark:text-green-400">
									{formatCurrency(totalReceived)}
								</div>
							</div>
						</Field>

						<FieldSeparator />

						{/* Received sub-section */}
						<Field orientation="responsive">
							<div className="flex-1">
								<FieldContent>
									<FieldTitle className="flex items-center gap-2">
										<BanknoteIcon className="h-4 w-4" />
										Received
									</FieldTitle>
									<FieldDescription>
										Payments already collected from the
										client
									</FieldDescription>
								</FieldContent>
							</div>
						</Field>
						{paymentFields.length === 0 ? (
							<div className="flex items-center gap-3 py-6 px-4 border border-dashed rounded-lg">
								<BanknoteIcon className="h-8 w-8 text-muted-foreground/50 shrink-0" />
								<div className="text-left">
									<p className="text-sm text-muted-foreground">
										No payments recorded yet
									</p>
									<Button
										type="button"
										variant="link"
										size="sm"
										className="h-auto p-0"
										onClick={addNewPayment}
									>
										Add first payment
									</Button>
								</div>
							</div>
						) : (
							<div className="space-y-3">
								{paymentFields.map((payment, index) => (
									<PaymentRow
										key={payment.id}
										index={index}
										onRemove={() => removePayment(index)}
									/>
								))}
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="w-full justify-center border-dashed"
									onClick={addNewPayment}
								>
									<PlusIcon className="mr-2 h-4 w-4" />
									Add another payment
								</Button>
							</div>
						)}

						<FieldSeparator />

						{/* Scheduled sub-section */}
						<Field orientation="responsive">
							<div className="flex-1">
								<FieldContent>
									<FieldTitle className="flex items-center gap-2">
										<CalendarIcon className="h-4 w-4" />
										Scheduled
									</FieldTitle>
									<FieldDescription>
										Upcoming payment milestones
									</FieldDescription>
								</FieldContent>
							</div>
						</Field>
						{scheduleFields.length === 0 ? (
							<div className="flex items-center gap-3 py-6 px-4 border border-dashed rounded-lg">
								<CalendarIcon className="h-8 w-8 text-muted-foreground/50 shrink-0" />
								<div className="text-left flex-1">
									<p className="text-sm text-muted-foreground mb-2">
										No payment schedule set
									</p>
									<div className="flex flex-wrap gap-2">
										{PAYMENT_SCHEDULE_PRESETS.slice(
											0,
											3,
										).map((preset) => (
											<Button
												key={preset.value}
												type="button"
												variant="outline"
												size="sm"
												onClick={() =>
													addNewSchedule(preset.label)
												}
											>
												<PlusIcon className="mr-1 h-3 w-3" />
												{preset.label}
											</Button>
										))}
									</div>
								</div>
							</div>
						) : (
							<div className="space-y-3">
								{scheduleFields.map((schedule, index) => (
									<ScheduleRow
										key={schedule.id}
										index={index}
										onRemove={() => removeSchedule(index)}
									/>
								))}
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="w-full justify-center border-dashed"
									onClick={() => addNewSchedule()}
								>
									<PlusIcon className="mr-2 h-4 w-4" />
									Add another milestone
								</Button>
							</div>
						)}
					</FieldGroup>
				</FieldSet>
			</CardContent>
		</Card>
	);
}

interface PaymentRowProps {
	index: number;
	onRemove: () => void;
}

function PaymentRow({ index, onRemove }: PaymentRowProps) {
	const form = useFormContext<BookingFormValues>();

	return (
		<div className="overflow-hidden rounded-lg border bg-muted/10">
			{/* Header row */}
			<div className="flex items-center justify-between gap-2 border-b bg-muted/20 px-4 py-3">
				<div className="flex items-center gap-2">
					<BanknoteIcon className="h-4 w-4 text-muted-foreground" />
					<span className="text-sm font-medium">
						Payment {index + 1}
					</span>
				</div>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
					onClick={onRemove}
				>
					<TrashIcon className="h-4 w-4" />
					<span className="sr-only">Remove payment</span>
				</Button>
			</div>

			{/* Content */}
			<div className="p-4">
				<div className="grid gap-3 grid-cols-2 md:grid-cols-5">
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
											const value =
												e.target.value.replace(
													/[^0-9.]/g,
													"",
												);
											const parts = value.split(".");
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
										{PAYMENT_METHOD_OPTIONS.map(
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
								<FieldLabel htmlFor={field.name}>
									Date
								</FieldLabel>
								<DatePicker
									value={field.value}
									onValueChange={field.onChange}
									id={field.name}
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
			</div>
		</div>
	);
}

interface ScheduleRowProps {
	index: number;
	onRemove: () => void;
}

function ScheduleRow({ index, onRemove }: ScheduleRowProps) {
	const form = useFormContext<BookingFormValues>();

	return (
		<div className="overflow-hidden rounded-lg border bg-muted/10">
			{/* Header row */}
			<div className="flex items-center justify-between gap-2 border-b bg-muted/20 px-4 py-3">
				<div className="flex items-center gap-2">
					<CalendarIcon className="h-4 w-4 text-muted-foreground" />
					<span className="text-sm font-medium">
						Milestone {index + 1}
					</span>
				</div>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
					onClick={onRemove}
				>
					<TrashIcon className="h-4 w-4" />
					<span className="sr-only">Remove milestone</span>
				</Button>
			</div>

			{/* Content */}
			<div className="p-4">
				<div className="grid gap-3 grid-cols-2 md:grid-cols-4">
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
											const value =
												e.target.value.replace(
													/[^0-9.]/g,
													"",
												);
											const parts = value.split(".");
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
								<DatePicker
									value={field.value}
									onValueChange={field.onChange}
									id={field.name}
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
			</div>
		</div>
	);
}
