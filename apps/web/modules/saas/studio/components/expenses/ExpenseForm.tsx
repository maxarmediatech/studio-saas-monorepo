"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { ExpenseDetail } from "@repo/api/modules/studio/schemas/expense";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Combobox, type ComboboxOption } from "@repo/ui/components/combobox";
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
	InputGroupButton,
	InputGroupInput,
	InputGroupText,
	InputGroupTextarea,
} from "@repo/ui/components/input-group";
import { MultiSelectCombobox } from "@repo/ui/components/multi-select-combobox";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Separator } from "@repo/ui/components/separator";
import { bookingsApi, crewsApi, shootsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import {
	ChevronDownIcon,
	ChevronUpIcon,
	FileTextIcon,
	Loader2Icon,
	PaperclipIcon,
	XIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { FormActions } from "../ui/FormActions";

function getInitials(name: string): string {
	return name
		.split(" ")
		.map((part) => part[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
}

function formatFileSize(bytes: number) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const uploadedAttachmentSchema = z.object({
	name: z.string(),
	size: z.number(),
	type: z.string(),
	key: z.string(),
	url: z.string(),
});

const expenseFormSchema = z.object({
	bookingId: z.string().min(1, "Booking is required"),
	shootId: z.string().optional().or(z.literal("")),
	description: z.string().min(1, "Description is required").max(500),
	amount: z
		.string()
		.min(1, "Amount is required")
		.regex(/^\d+(\.\d{1,2})?$/, "Must be a valid amount"),
	expenseDate: z.string().min(1, "Date is required"),
	billTo: z.enum(["studio", "client"]),
	crewAssignments: z
		.array(z.object({ crewId: z.string().min(1) }))
		.optional(),
	category: z.string().max(100).optional().or(z.literal("")),
	vendor: z.string().max(255).optional().or(z.literal("")),
	paymentMethod: z
		.enum(["cash", "upi", "bank_transfer", "cheque", "card", "other"])
		.optional(),
	notes: z.string().max(10000).optional().or(z.literal("")),
	receiptAttachment: uploadedAttachmentSchema.nullable().optional(),
});

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

interface BookingInfo {
	id: string;
	name: string;
	referenceNumber: string;
}

interface ShootInfo {
	id: string;
	name: string;
}

interface CrewOption {
	value: string;
	label: string;
}

interface ExpenseFormProps {
	defaultValues?: ExpenseDetail;
	defaultBookingId?: string;
	booking?: BookingInfo;
	shoot?: ShootInfo;
	crewIdsFromMetadata?: string[];
	existingAssignments?: ExpenseDetail["assignments"];
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

export function ExpenseForm({
	defaultValues,
	defaultBookingId,
	booking,
	shoot,
	crewIdsFromMetadata,
	existingAssignments,
	onSubmit,
	mode,
	isPending = false,
	onScrollChange,
}: ExpenseFormProps) {
	const [showDetails, setShowDetails] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const form = useForm<ExpenseFormValues>({
		resolver: zodResolver(expenseFormSchema),
		defaultValues: {
			bookingId: defaultBookingId ?? "",
			shootId: "",
			description: "",
			amount: "",
			expenseDate: new Date().toISOString().split("T")[0],
			billTo: "studio",
			crewAssignments: [],
			category: "",
			vendor: "",
			paymentMethod: undefined,
			notes: "",
			receiptAttachment: null,
		},
	});

	const selectedBookingId = form.watch("bookingId");
	const billTo = form.watch("billTo");
	const notesValue = form.watch("notes");
	const receiptAttachment = form.watch("receiptAttachment");
	const crewAssignments = form.watch("crewAssignments") ?? [];

	useEffect(() => {
		if (billTo !== "studio" && billTo !== "client") {
			form.setValue("billTo", "studio", { shouldValidate: true });
		}
	}, [billTo, form]);

	const { data: bookingsData, isLoading: isLoadingBookings } = useQuery({
		...bookingsApi.listMinimalOptions({}),
		enabled: mode === "create",
	});
	const bookings = bookingsData?.data ?? [];

	const { data: shootsData, isLoading: isLoadingShoots } = useQuery({
		...shootsApi.listMinimalOptions({ bookingId: selectedBookingId }),
		enabled: !!selectedBookingId,
	});
	const shoots = shootsData?.data ?? [];

	const { data: crewsData } = useQuery(crewsApi.listOptions({}));
	const crews = crewsData?.data ?? [];

	useEffect(() => {
		if (defaultValues) {
			const bookingAssignment = existingAssignments?.find(
				(a) => a.bookingId,
			);
			const shootAssignment = existingAssignments?.find((a) => a.shootId);

			const metadata = defaultValues.metadata as {
				receiptAttachment?: ExpenseFormValues["receiptAttachment"];
				shootId?: string;
			} | null;

			const resolvedBookingId =
				booking?.id ?? bookingAssignment?.bookingId ?? "";
			const resolvedShootId =
				shoot?.id ??
				metadata?.shootId ??
				shootAssignment?.shootId ??
				"";

			const crewAssignments =
				crewIdsFromMetadata && crewIdsFromMetadata.length > 0
					? crewIdsFromMetadata.map((id) => ({ crewId: id }))
					: (existingAssignments
							?.filter((a) => a.crewId)
							.map((a) => ({ crewId: a.crewId! })) ?? []);

			const validBillTo =
				defaultValues.billTo === "studio" ||
				defaultValues.billTo === "client"
					? defaultValues.billTo
					: "studio";

			form.reset({
				bookingId: resolvedBookingId,
				shootId: resolvedShootId,
				description: defaultValues.description,
				amount: defaultValues.amount,
				expenseDate: defaultValues.expenseDate,
				billTo: validBillTo,
				crewAssignments: crewAssignments,
				category: defaultValues.category ?? "",
				vendor: defaultValues.vendor ?? "",
				paymentMethod: defaultValues.paymentMethod ?? undefined,
				notes: defaultValues.notes ?? "",
				receiptAttachment: metadata?.receiptAttachment ?? null,
			});

			if (
				defaultValues.category ||
				defaultValues.vendor ||
				defaultValues.paymentMethod ||
				defaultValues.notes
			) {
				setShowDetails(true);
			}
		}
	}, [
		defaultValues,
		existingAssignments,
		booking,
		shoot,
		crewIdsFromMetadata,
		form,
	]);

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

	const shootOptions = useMemo((): ComboboxOption[] => {
		const options = shoots.map((s) => ({
			value: s.id,
			label: `${s.name || s.shootType} (${s.shootDate})`,
		}));

		if (shoot && !options.some((o) => o.value === shoot.id)) {
			options.unshift({
				value: shoot.id,
				label: shoot.name,
			});
		}

		return options;
	}, [shoots, shoot]);

	const crewOptions: CrewOption[] = useMemo(
		() =>
			crews.map((crew) => ({
				value: crew.id,
				label: crew.name,
			})),
		[crews],
	);

	const isSubmitting = form.formState.isSubmitting || isPending;

	const handleScroll = useCallback(
		(event: React.UIEvent<HTMLDivElement>) => {
			const target = event.target as HTMLDivElement;
			const isScrolled = target.scrollTop > 0;
			onScrollChange?.(isScrolled);
		},
		[onScrollChange],
	);

	const handleFileUpload = async (file: File) => {
		if (file.size > 5 * 1024 * 1024) {
			toast.error("File size must be less than 5MB");
			return;
		}

		setIsUploading(true);
		try {
			const presignedUrlRes = await fetch("/api/uploads/presigned-url", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					fileName: file.name,
					fileType: file.type,
					fileSize: file.size,
					context: "receipts",
				}),
			});

			if (!presignedUrlRes.ok) {
				const error = await presignedUrlRes.json();
				throw new Error(error.message || "Failed to get upload URL");
			}

			const { url, key } = await presignedUrlRes.json();

			const uploadRes = await fetch(url, {
				method: "PUT",
				body: file,
				headers: { "Content-Type": file.type },
			});

			if (uploadRes.ok) {
				const finalUrl = url.split("?")[0];
				form.setValue(
					"receiptAttachment",
					{
						name: file.name,
						size: file.size,
						type: file.type,
						key: key,
						url: finalUrl,
					},
					{ shouldValidate: true, shouldDirty: true },
				);
				toast.success("Receipt uploaded successfully");
			} else {
				throw new Error("Upload failed");
			}
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Failed to upload file";
			toast.error(message);
		} finally {
			setIsUploading(false);
		}
	};

	const handleFileRemove = async () => {
		const currentAttachment = form.getValues("receiptAttachment");
		if (!currentAttachment) return;

		setIsDeleting(true);
		try {
			const deleteRes = await fetch("/api/uploads/file", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ key: currentAttachment.key }),
			});
			if (!deleteRes.ok) {
				throw new Error("Delete failed");
			}
			form.setValue("receiptAttachment", null, {
				shouldValidate: true,
				shouldDirty: true,
			});
			toast.success("Receipt removed");
		} catch {
			toast.error("Failed to remove file");
		} finally {
			setIsDeleting(false);
		}
	};

	const handleBookingChange = (value: string) => {
		form.setValue("bookingId", value);
		form.setValue("shootId", "");
	};

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
						<Controller
							name="bookingId"
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor={field.name}>
										Booking *
									</FieldLabel>
									<Combobox
										id={field.name}
										value={field.value}
										onValueChange={handleBookingChange}
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
							name="shootId"
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor={field.name}>
										Shoot (optional)
									</FieldLabel>
									<Combobox
										id={field.name}
										value={field.value ?? ""}
										onValueChange={field.onChange}
										options={shootOptions}
										placeholder={
											!selectedBookingId
												? "Select a booking first"
												: isLoadingShoots
													? "Loading shoots..."
													: shoots.length === 0
														? "No shoots for this booking"
														: "Select shoot..."
										}
										searchPlaceholder="Search shoots..."
										emptyText="No shoots found"
										disabled={
											mode === "edit" ||
											!selectedBookingId ||
											isLoadingShoots ||
											shoots.length === 0
										}
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
										placeholder="What was this expense for?"
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

						<div className="grid grid-cols-3 gap-4">
							<Controller
								name="amount"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={field.name}>
											Amount *
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
														value.split(".");
													if (parts.length > 2)
														return;
													if (
														parts[1] &&
														parts[1].length > 2
													)
														return;
													field.onChange(value);
												}}
											/>
										</InputGroup>
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
										<DatePicker
											value={field.value}
											onValueChange={field.onChange}
											id={field.name}
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

							<Controller
								name="billTo"
								control={form.control}
								render={({ field, fieldState }) => {
									const value =
										field.value === "studio" ||
										field.value === "client"
											? field.value
											: "studio";

									return (
										<Field
											data-invalid={fieldState.invalid}
										>
											<FieldLabel htmlFor={field.name}>
												Bill To *
											</FieldLabel>
											<Select
												onValueChange={field.onChange}
												value={value}
											>
												<SelectTrigger
													id={field.name}
													aria-invalid={
														fieldState.invalid
													}
												>
													<SelectValue placeholder="Who pays?" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="studio">
														Studio
													</SelectItem>
													<SelectItem value="client">
														Client
													</SelectItem>
												</SelectContent>
											</Select>
											{fieldState.invalid && (
												<FieldError
													errors={[fieldState.error]}
												/>
											)}
										</Field>
									);
								}}
							/>
						</div>

						<Controller
							name="crewAssignments"
							control={form.control}
							render={({ field }) => {
								const selectedIds = (field.value ?? []).map(
									(a) => a.crewId,
								);

								return (
									<Field>
										<FieldLabel>
											Expense By (Crew)
										</FieldLabel>
										<MultiSelectCombobox
											options={crewOptions}
											value={selectedIds}
											onValueChange={(ids) => {
												field.onChange(
													ids.map((id) => ({
														crewId: id,
													})),
												);
											}}
											placeholder="Who made this expense?"
											searchPlaceholder="Search crew..."
											emptyText="No crew members found"
											renderOption={(option) => (
												<div className="flex items-center gap-2">
													<Avatar className="h-6 w-6">
														<AvatarFallback className="text-[10px]">
															{getInitials(
																option.label,
															)}
														</AvatarFallback>
													</Avatar>
													<span>{option.label}</span>
												</div>
											)}
											renderSelectedItem={(
												option,
												onRemove,
											) => (
												<Badge
													variant="secondary"
													className="flex items-center gap-1.5 pr-1"
												>
													<Avatar className="h-4 w-4">
														<AvatarFallback className="text-[8px]">
															{getInitials(
																option.label,
															)}
														</AvatarFallback>
													</Avatar>
													<span className="truncate">
														{option.label}
													</span>
													<button
														type="button"
														onClick={(e) => {
															e.stopPropagation();
															onRemove();
														}}
														className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
													>
														<XIcon className="size-3" />
														<span className="sr-only">
															Remove{" "}
															{option.label}
														</span>
													</button>
												</Badge>
											)}
										/>
									</Field>
								);
							}}
						/>

						{(showDetails ||
							form.watch("category") ||
							form.watch("vendor") ||
							form.watch("paymentMethod") ||
							form.watch("notes") ||
							receiptAttachment) && (
							<>
								<div className="flex items-center justify-between">
									<span className="text-sm font-medium text-muted-foreground">
										Additional Details
									</span>
									{showDetails &&
										!form.watch("category") &&
										!form.watch("vendor") &&
										!form.watch("paymentMethod") &&
										!form.watch("notes") &&
										!receiptAttachment && (
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="h-auto py-0 px-1 text-muted-foreground"
												onClick={() =>
													setShowDetails(false)
												}
											>
												<ChevronUpIcon className="mr-1 h-3.5 w-3.5" />
												Hide
											</Button>
										)}
								</div>

								<div className="grid grid-cols-3 gap-4">
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
													placeholder="e.g., Travel"
													aria-invalid={
														fieldState.invalid
													}
												/>
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
													placeholder="e.g., Amazon"
													aria-invalid={
														fieldState.invalid
													}
												/>
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
													Payment
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
														<SelectValue placeholder="Method" />
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
												Notes & Receipt
											</FieldLabel>
											<InputGroup>
												<InputGroupTextarea
													{...field}
													id={field.name}
													placeholder="Add notes or reference information..."
													rows={2}
													aria-invalid={
														fieldState.invalid
													}
												/>
												<InputGroupAddon align="block-end">
													<input
														ref={fileInputRef}
														type="file"
														className="hidden"
														accept=".pdf,.jpg,.jpeg,.png,.webp"
														onChange={(e) => {
															const file =
																e.target
																	.files?.[0];
															if (file) {
																handleFileUpload(
																	file,
																);
															}
															e.target.value = "";
														}}
													/>

													{isUploading ? (
														<InputGroupText>
															<Loader2Icon className="h-4 w-4 animate-spin" />
															<span className="text-xs">
																Uploading...
															</span>
														</InputGroupText>
													) : receiptAttachment ? (
														<>
															<InputGroupText className="gap-1.5">
																<FileTextIcon className="h-4 w-4 text-primary" />
																<span
																	className="max-w-[150px] truncate text-xs"
																	title={
																		receiptAttachment.name
																	}
																>
																	{
																		receiptAttachment.name
																	}
																</span>
																<span className="text-xs text-muted-foreground">
																	(
																	{formatFileSize(
																		receiptAttachment.size,
																	)}
																	)
																</span>
															</InputGroupText>
															<InputGroupButton
																variant="ghost"
																size="icon-xs"
																onClick={
																	handleFileRemove
																}
																disabled={
																	isDeleting
																}
																className="text-destructive hover:text-destructive"
															>
																{isDeleting ? (
																	<Loader2Icon className="h-3.5 w-3.5 animate-spin" />
																) : (
																	<XIcon className="h-3.5 w-3.5" />
																)}
																<span className="sr-only">
																	Remove
																	receipt
																</span>
															</InputGroupButton>
														</>
													) : (
														<InputGroupButton
															variant="ghost"
															size="xs"
															onClick={() =>
																fileInputRef.current?.click()
															}
														>
															<PaperclipIcon className="h-4 w-4" />
															Attach Receipt
														</InputGroupButton>
													)}

													<Separator
														orientation="vertical"
														className="!h-4 ml-auto"
													/>

													<InputGroupText className="text-xs text-muted-foreground">
														PDF or Image
													</InputGroupText>
												</InputGroupAddon>
											</InputGroup>
											{fieldState.invalid && (
												<FieldError
													errors={[fieldState.error]}
												/>
											)}
										</Field>
									)}
								/>
							</>
						)}

						{!showDetails &&
							!form.watch("category") &&
							!form.watch("vendor") &&
							!form.watch("paymentMethod") &&
							!form.watch("notes") &&
							!receiptAttachment && (
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
