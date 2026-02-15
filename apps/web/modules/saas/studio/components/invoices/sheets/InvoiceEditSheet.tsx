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
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
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
import { useInvoiceEditParams } from "@saas/studio/hooks/params/use-invoice-edit-params";
import { invoicesApi, invoicesMutations } from "@saas/studio/lib/api";
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

const invoiceEditFormSchema = z.object({
	issueDate: z.string().min(1, "Issue date is required"),
	dueDate: z.string().optional().or(z.literal("")),
	discountAmount: z.string().optional().or(z.literal("")),
	taxType: z.enum(["exclusive", "inclusive", "no_gst"]),
	notes: z.string().max(10000).optional().or(z.literal("")),
	terms: z.string().max(5000).optional().or(z.literal("")),
});

type InvoiceEditFormValues = z.infer<typeof invoiceEditFormSchema>;

export function InvoiceEditSheet() {
	const { invoiceId, close } = useInvoiceEditParams();
	const isOpen = Boolean(invoiceId);
	const queryClient = useQueryClient();
	const [isScrolled, setIsScrolled] = useState(false);

	const { data: invoice, isLoading, isError } = useQuery({
		...invoicesApi.getOptions(invoiceId ?? ""),
		enabled: isOpen && !!invoiceId,
	});

	const updateMutation = useMutation({
		...invoicesMutations.update(),
		onSuccess: () => {
			toast.success("Invoice updated successfully");
			queryClient.invalidateQueries({
				queryKey: orpc.invoices.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.activities.key(),
			});
			close();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to update invoice");
		},
	});

	const invoiceData = invoice?.data;

	const form = useForm<InvoiceEditFormValues>({
		resolver: zodResolver(invoiceEditFormSchema),
		defaultValues: {
			issueDate: "",
			dueDate: "",
			discountAmount: "",
			taxType: "exclusive",
			notes: "",
			terms: "",
		},
	});

	useEffect(() => {
		if (invoiceData) {
			form.reset({
				issueDate: invoiceData.issueDate ?? "",
				dueDate: invoiceData.dueDate ?? "",
				discountAmount: invoiceData.discountAmount ?? "",
				taxType: invoiceData.taxType ?? "exclusive",
				notes: invoiceData.notes ?? "",
				terms: invoiceData.terms ?? "",
			});
		}
	}, [invoiceData, form]);

	const handleSubmit = async (data: InvoiceEditFormValues) => {
		if (!invoiceId) {
			return;
		}

		await updateMutation.mutateAsync({
			id: invoiceId,
			issueDate: data.issueDate,
			dueDate: data.dueDate || null,
			discountAmount: data.discountAmount || undefined,
			taxType: data.taxType,
			notes: data.notes || null,
			terms: data.terms || null,
		});
	};

	const isSubmitting = form.formState.isSubmitting || updateMutation.isPending;

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
					<SheetTitle className="text-xl">Edit Invoice</SheetTitle>
				</SheetHeader>
				<div className="flex-1 min-h-0">
					{isLoading ? (
						<div className="space-y-4 px-4 py-4">
							<div className="flex gap-2">
								<Skeleton className="h-6 w-24" />
								<Skeleton className="h-6 w-20" />
							</div>
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-24 w-full" />
							<Skeleton className="h-24 w-full" />
						</div>
					) : isError || !invoiceData ? (
						<div className="flex flex-col items-center justify-center gap-4 px-4 py-12 text-center">
							<p className="text-sm text-muted-foreground">
								Failed to load invoice data.
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
											name="discountAmount"
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
														Discount
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
																	value.split(
																		".",
																	);
																if (
																	parts.length >
																	2
																) {
																	return;
																}
																if (
																	parts[1] &&
																	parts[1]
																		.length >
																		2
																) {
																	return;
																}
																field.onChange(
																	value,
																);
															}}
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
									mode="edit"
									isSubmitting={isSubmitting}
									submitLabel="Save Changes"
								/>
							</div>
						</form>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
