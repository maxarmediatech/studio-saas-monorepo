"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { PaymentMethod } from "@repo/api/modules/studio/schemas/common";
import { Button } from "@repo/ui/components/button";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Textarea } from "@repo/ui/components/textarea";
import { useScheduleConvertParams } from "@saas/studio/hooks/params/use-schedule-convert-params";
import {
	studioPaymentsApi,
	studioPaymentsMutations,
} from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { FormActions } from "../../ui/FormActions";

const PAYMENT_METHODS: ReadonlyArray<{ value: PaymentMethod; label: string }> = [
	{ value: "cash", label: "Cash" },
	{ value: "upi", label: "UPI" },
	{ value: "bank_transfer", label: "Bank Transfer" },
	{ value: "cheque", label: "Cheque" },
	{ value: "card", label: "Card" },
	{ value: "other", label: "Other" },
];

const convertScheduleFormSchema = z.object({
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
	receivedDate: z.string().min(1, "Received date is required"),
	transactionReference: z.string().max(100).optional().or(z.literal("")),
	notes: z.string().max(10000).optional().or(z.literal("")),
});

type ConvertScheduleFormValues = z.infer<typeof convertScheduleFormSchema>;

function formatAmountInput(value: number): string {
	if (!Number.isFinite(value) || value <= 0) {
		return "";
	}
	return value.toFixed(2);
}

export function ScheduleConvertSheet() {
	const { convertScheduleId, close } = useScheduleConvertParams();
	const isOpen = Boolean(convertScheduleId);
	const queryClient = useQueryClient();

	const { data: schedule, isLoading } = useQuery({
		...studioPaymentsApi.getScheduleOptions(convertScheduleId ?? ""),
		enabled: isOpen && !!convertScheduleId,
	});

	const convertMutation = useMutation({
		...studioPaymentsMutations.convertSchedule(),
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: orpc.studioPayments.key(),
				}),
				queryClient.invalidateQueries({ queryKey: orpc.bookings.key() }),
				queryClient.invalidateQueries({ queryKey: orpc.invoices.key() }),
				queryClient.invalidateQueries({ queryKey: orpc.receipts.key() }),
				queryClient.invalidateQueries({ queryKey: orpc.activities.key() }),
			]);
			toast.success("Payment recorded successfully");
			close();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to convert payment schedule");
		},
	});

	const form = useForm<ConvertScheduleFormValues>({
		resolver: zodResolver(convertScheduleFormSchema),
		defaultValues: {
			amount: "",
			paymentMethod: "upi",
			receivedDate: new Date().toISOString().split("T")[0],
			transactionReference: "",
			notes: "",
		},
	});

	const remainingAmount = useMemo(() => {
		const scheduleAmount = Number(schedule?.data?.amount ?? "0");
		const paidAmount = Number(schedule?.data?.paidAmount ?? "0");
		return Math.max(scheduleAmount - paidAmount, 0);
	}, [schedule?.data?.amount, schedule?.data?.paidAmount]);

	const scheduleStatus = schedule?.data?.status;
	const isFullyPaid = remainingAmount <= 0;
	const isLockedSchedule =
		isFullyPaid ||
		scheduleStatus === "partial" ||
		scheduleStatus === "completed" ||
		scheduleStatus === "cancelled";
	const lockedScheduleMessage =
		scheduleStatus === "cancelled"
			? "Cancelled schedules cannot accept payments."
			: scheduleStatus === "partial"
				? "This schedule already has a recorded payment and is locked."
				: "This schedule is already fully paid.";

	useEffect(() => {
		if (!schedule?.data) {
			return;
		}

		form.reset({
			amount: formatAmountInput(remainingAmount),
			paymentMethod: "upi",
			receivedDate: new Date().toISOString().split("T")[0],
			transactionReference: "",
			notes: "",
		});
	}, [form, remainingAmount, schedule?.data]);

	const onSubmit = async (values: ConvertScheduleFormValues) => {
		if (!convertScheduleId) {
			return;
		}

		if (isLockedSchedule) {
			toast.error(lockedScheduleMessage);
			return;
		}

		await convertMutation.mutateAsync({
			scheduleId: convertScheduleId,
			amount: values.amount,
			paymentMethod: values.paymentMethod,
			transactionReference: values.transactionReference || undefined,
			receivedDate: values.receivedDate,
			notes: values.notes || undefined,
		});
	};

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
				<SheetContent
					side="right"
					className="sm:max-w-xl p-0 gap-0 flex flex-col"
				>
					<SheetHeader className="shrink-0 p-4">
						<SheetTitle className="text-xl">Record Payment</SheetTitle>
					</SheetHeader>
				<div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
					{isLoading ? (
						<div className="space-y-4">
							<Skeleton className="h-14 w-full" />
							<Skeleton className="h-20 w-full" />
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-10 w-full" />
						</div>
					) : schedule?.data ? (
							<form onSubmit={form.handleSubmit(onSubmit)}>
							{isLockedSchedule && (
								<p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
									{lockedScheduleMessage}
								</p>
							)}

							<FieldGroup>
								<Field>
									<FieldLabel htmlFor="schedule-name">Schedule</FieldLabel>
									<Input
										id="schedule-name"
										value={schedule.data.name}
										disabled
										readOnly
									/>
								</Field>

								<Controller
									name="amount"
									control={form.control}
									render={({ field, fieldState }) => (
										<Field data-invalid={fieldState.invalid}>
											<FieldLabel htmlFor={field.name}>Amount *</FieldLabel>
											<InputGroup>
												<InputGroupAddon>
													<InputGroupText>₹</InputGroupText>
												</InputGroupAddon>
												<InputGroupInput
													{...field}
													id={field.name}
													placeholder="0.00"
													aria-invalid={fieldState.invalid}
													onChange={(event) => {
														const value = event.target.value.replace(/[^0-9.]/g, "");
														const parts = value.split(".");
														if (parts.length > 2) {
															return;
														}
														if (parts[1] && parts[1].length > 2) {
															return;
														}
														field.onChange(value);
													}}
												/>
											</InputGroup>
											{fieldState.invalid && (
												<FieldError errors={[fieldState.error]} />
											)}
										</Field>
									)}
								/>

								<Controller
									name="paymentMethod"
									control={form.control}
									render={({ field, fieldState }) => (
										<Field data-invalid={fieldState.invalid}>
											<FieldLabel htmlFor={field.name}>Payment Method *</FieldLabel>
											<Select value={field.value} onValueChange={field.onChange}>
												<SelectTrigger id={field.name} aria-invalid={fieldState.invalid}>
													<SelectValue placeholder="Select payment method" />
												</SelectTrigger>
												<SelectContent>
													{PAYMENT_METHODS.map((method) => (
														<SelectItem key={method.value} value={method.value}>
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

								<Controller
									name="receivedDate"
									control={form.control}
									render={({ field, fieldState }) => (
										<Field data-invalid={fieldState.invalid}>
											<FieldLabel htmlFor={field.name}>Received Date *</FieldLabel>
											<DatePicker
												value={field.value}
												onValueChange={field.onChange}
												onBlur={field.onBlur}
												id={field.name}
												aria-invalid={fieldState.invalid}
											/>
											{fieldState.invalid && (
												<FieldError errors={[fieldState.error]} />
											)}
										</Field>
									)}
								/>

								<Controller
									name="transactionReference"
									control={form.control}
									render={({ field, fieldState }) => (
										<Field data-invalid={fieldState.invalid}>
											<FieldLabel htmlFor={field.name}>Transaction Reference</FieldLabel>
											<Input
												{...field}
												id={field.name}
												placeholder="UTR / Ref no."
												value={field.value ?? ""}
												aria-invalid={fieldState.invalid}
											/>
											{fieldState.invalid && (
												<FieldError errors={[fieldState.error]} />
											)}
										</Field>
									)}
								/>

								<Controller
									name="notes"
									control={form.control}
									render={({ field, fieldState }) => (
										<Field data-invalid={fieldState.invalid}>
											<FieldLabel htmlFor={field.name}>Notes</FieldLabel>
											<Textarea
												{...field}
												id={field.name}
												placeholder="Optional notes"
												value={field.value ?? ""}
												className="resize-none"
												rows={3}
												aria-invalid={fieldState.invalid}
											/>
											{fieldState.invalid && (
												<FieldError errors={[fieldState.error]} />
											)}
										</Field>
									)}
								/>
							</FieldGroup>

							<FormActions
								mode="edit"
								isSubmitting={
									form.formState.isSubmitting ||
									convertMutation.isPending ||
									isLockedSchedule
								}
								submitLabel="Record Payment"
							/>

							<div className="pt-3">
								<Button
									type="button"
									variant="outline"
									className="w-full"
									onClick={close}
									disabled={
										form.formState.isSubmitting || convertMutation.isPending
									}
								>
									Cancel
								</Button>
							</div>
						</form>
					) : (
						<div className="text-sm text-muted-foreground">
							Schedule not found.
						</div>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
