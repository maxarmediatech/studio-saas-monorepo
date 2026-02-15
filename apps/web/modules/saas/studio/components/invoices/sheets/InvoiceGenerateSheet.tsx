"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@repo/ui/components/button";
import { DatePicker } from "@repo/ui/components/date-picker";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@repo/ui/components/field";
import {
	InputGroup,
	InputGroupTextarea,
} from "@repo/ui/components/input-group";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
	RadioGroup,
	RadioGroupItem,
} from "@repo/ui/components/radio-group";
import { cn } from "@repo/ui/lib/utils";
import { useInvoiceGenerateParams } from "@saas/studio/hooks/params/use-invoice-generate-params";
import {
	invoicesMutations,
	studioPaymentsApi,
} from "@saas/studio/lib/api";
import { formatMoney } from "@saas/shared/lib";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { FormActions } from "../../ui/FormActions";

const taxTypeOptions = [
	{ value: "exclusive", label: "Exclusive", description: "Tax added on top" },
	{
		value: "inclusive",
		label: "Inclusive",
		description: "Tax included in price",
	},
	{ value: "no_gst", label: "No GST", description: "No tax applied" },
] as const;

const invoiceGenerateFormSchema = z.object({
	issueDate: z.string().min(1, "Issue date is required"),
	dueDate: z.string().optional().or(z.literal("")),
	taxType: z.enum(["exclusive", "inclusive", "no_gst"]),
	notes: z.string().max(10000).optional().or(z.literal("")),
	terms: z.string().max(5000).optional().or(z.literal("")),
});

type InvoiceGenerateFormValues = z.infer<typeof invoiceGenerateFormSchema>;

const defaultInvoiceGenerateValues: InvoiceGenerateFormValues = {
	issueDate: "",
	dueDate: "",
	taxType: "no_gst",
	notes: "",
	terms: "",
};

export function InvoiceGenerateSheet() {
	const { scheduleId, close } = useInvoiceGenerateParams();
	const isOpen = Boolean(scheduleId);
	const queryClient = useQueryClient();
	const [isScrolled, setIsScrolled] = useState(false);

	const {
		data: scheduleData,
		isLoading,
		isError,
	} = useQuery({
		...studioPaymentsApi.getScheduleOptions(scheduleId ?? ""),
		enabled: isOpen && !!scheduleId,
	});

	const createMutation = useMutation({
		...invoicesMutations.createFromSchedule(),
		onSuccess: () => {
			toast.success("Invoice generated successfully");
			queryClient.invalidateQueries({
				queryKey: orpc.studioPayments.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.invoices.key(),
			});
			close();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to generate invoice");
		},
	});

	const schedule = scheduleData?.data;

	const form = useForm<InvoiceGenerateFormValues>({
		resolver: zodResolver(invoiceGenerateFormSchema),
		defaultValues: defaultInvoiceGenerateValues,
	});

	useEffect(() => {
		if (!isOpen) {
			form.reset(defaultInvoiceGenerateValues);
			setIsScrolled(false);
			return;
		}

		if (schedule) {
			form.reset({
				...defaultInvoiceGenerateValues,
				issueDate: new Date().toISOString().split("T")[0],
				dueDate: schedule.dueDate ?? "",
				taxType: schedule.taxType ?? "no_gst",
			});
		}
	}, [isOpen, scheduleId, schedule, form]);

	const handleSubmit = async (data: InvoiceGenerateFormValues) => {
		if (!scheduleId) {
			return;
		}

		await createMutation.mutateAsync({
			paymentScheduleId: scheduleId,
			issueDate: data.issueDate || undefined,
			dueDate: data.dueDate || undefined,
			taxType: data.taxType,
			notes: data.notes || undefined,
			terms: data.terms || undefined,
		});
	};

	const isSubmitting = form.formState.isSubmitting || createMutation.isPending;

	const handleScroll = useCallback(
		(event: React.UIEvent<HTMLDivElement>) => {
			const target = event.target as HTMLDivElement;
			setIsScrolled(target.scrollTop > 0);
		},
		[],
	);

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
			<SheetContent
				side="right"
				className="sm:max-w-md p-0 gap-0 flex flex-col"
			>
				<SheetHeader
					className={cn(
						"shrink-0 p-4 transition-shadow duration-200",
						isScrolled &&
							"shadow-[0_4px_12px_-4px_rgba(0,0,0,0.15)]",
					)}
				>
					<SheetTitle className="text-xl">
						Generate Invoice
					</SheetTitle>
					{schedule && (
						<p className="text-sm text-muted-foreground">
							{schedule.name} &middot;{" "}
							{formatMoney(schedule.amount)} &middot;{" "}
							{schedule.booking.name}
						</p>
					)}
				</SheetHeader>
				<div className="flex-1 min-h-0">
					{isLoading ? (
						<div className="space-y-4 px-4 py-4">
							<Skeleton className="h-16 w-full rounded-lg" />
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-24 w-full" />
						</div>
					) : isError || !schedule ? (
						<div className="flex flex-col items-center justify-center gap-4 px-4 py-12 text-center">
							<p className="text-sm text-muted-foreground">
								Failed to load schedule data.
							</p>
							<Button variant="outline" size="sm" onClick={close}>
								Close
							</Button>
						</div>
					) : (
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
											name="issueDate"
											control={form.control}
											render={({
												field,
												fieldState,
											}) => (
												<Field
													data-invalid={
														fieldState.invalid
													}
												>
													<FieldLabel
														htmlFor={field.name}
													>
														Issue Date *
													</FieldLabel>
													<DatePicker
														value={field.value}
														onValueChange={
															field.onChange
														}
														onBlur={field.onBlur}
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
											name="dueDate"
											control={form.control}
											render={({
												field,
												fieldState,
											}) => (
												<Field
													data-invalid={
														fieldState.invalid
													}
												>
													<FieldLabel
														htmlFor={field.name}
													>
														Due Date
													</FieldLabel>
													<DatePicker
														value={field.value}
														onValueChange={
															field.onChange
														}
														onBlur={field.onBlur}
														id={field.name}
														aria-invalid={
															fieldState.invalid
														}
														placeholder="Not set"
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
											name="taxType"
											control={form.control}
											render={({ field }) => (
												<Field>
													<FieldLabel>
														GST Type
													</FieldLabel>
													<RadioGroup
														value={field.value}
														onValueChange={
															field.onChange
														}
														className="grid grid-cols-3 gap-2"
													>
														{taxTypeOptions.map(
															(option) => (
																<label
																	key={
																		option.value
																	}
																	className={cn(
																		"flex cursor-pointer flex-col items-center gap-1 rounded-md border p-3 text-center transition-colors hover:bg-muted/50",
																		field.value ===
																			option.value &&
																			"border-primary bg-primary/5",
																	)}
																>
																	<RadioGroupItem
																		value={
																			option.value
																		}
																		className="sr-only"
																	/>
																	<span className="text-sm font-medium">
																		{
																			option.label
																		}
																	</span>
																	<span className="text-[11px] text-muted-foreground">
																		{
																			option.description
																		}
																	</span>
																</label>
															),
														)}
													</RadioGroup>
												</Field>
											)}
										/>

										<Controller
											name="notes"
											control={form.control}
											render={({
												field,
												fieldState,
											}) => (
												<Field
													data-invalid={
														fieldState.invalid
													}
												>
													<FieldLabel
														htmlFor={field.name}
													>
														Notes
													</FieldLabel>
													<InputGroup>
														<InputGroupTextarea
															{...field}
															id={field.name}
															placeholder="Add any notes for the client..."
															rows={3}
															aria-invalid={
																fieldState.invalid
															}
														/>
													</InputGroup>
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
											name="terms"
											control={form.control}
											render={({
												field,
												fieldState,
											}) => (
												<Field
													data-invalid={
														fieldState.invalid
													}
												>
													<FieldLabel
														htmlFor={field.name}
													>
														Terms
													</FieldLabel>
													<InputGroup>
														<InputGroupTextarea
															{...field}
															id={field.name}
															placeholder="Payment terms and conditions..."
															rows={3}
															aria-invalid={
																fieldState.invalid
															}
														/>
													</InputGroup>
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
									</FieldGroup>
								</div>
							</ScrollArea>

							<div className="shrink-0 border-t p-4 bg-background">
								<FormActions
									mode="create"
									isSubmitting={isSubmitting}
									submitLabel="Generate Invoice"
								/>
							</div>
						</form>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
