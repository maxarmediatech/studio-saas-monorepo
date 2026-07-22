"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@repo/ui/components/field";
import {
	CustomField,
	DateField,
	SelectField,
} from "@repo/ui/components/form-fields";
import {
	FieldRow,
	FormSection,
	FormSectionHeading,
} from "@repo/ui/components/form-section";
import { Input } from "@repo/ui/components/input";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
	InputGroupText,
	InputGroupTextarea,
} from "@repo/ui/components/input-group";
import {
	AddItemButton,
	ItemCard,
	ItemCardHeader,
} from "@repo/ui/components/item-list";
import { Separator } from "@repo/ui/components/separator";
import {
	getUploadAccept,
	getUploadHelperText,
	getUploadResponseErrorMessage,
	validateUploadFile,
} from "@shared/lib/upload-policy";
import {
	BanknoteIcon,
	CalendarIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	FileTextIcon,
	Loader2Icon,
	PaperclipIcon,
	PlusIcon,
	XIcon,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
	Controller,
	useFieldArray,
	useFormContext,
	useWatch,
} from "react-hook-form";
import { toast } from "sonner";
import {
	type BookingFormValues,
	PAYMENT_METHOD_OPTIONS,
	PAYMENT_SCHEDULE_PRESETS,
} from "./booking-form-schema";

const PAYMENT_UPLOAD_ACCEPT = getUploadAccept("payments");
const PAYMENT_UPLOAD_HELPER_TEXT = getUploadHelperText("payments");

export function BookingPaymentsStep() {
	const form = useFormContext<BookingFormValues>();

	const packageCost =
		useWatch({ control: form.control, name: "packageCost" }) ?? "0";
	const payments =
		useWatch({ control: form.control, name: "payments" }) ?? [];
	const paymentSchedules =
		useWatch({ control: form.control, name: "paymentSchedules" }) ?? [];
	const shoots = form.watch("shoots") ?? [];
	const deliverables =
		useWatch({ control: form.control, name: "deliverables" }) ?? [];

	// Calculate totals including custom deliverable costs
	const { totalCost, totalReceived, totalScheduled } = useMemo(() => {
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

		return {
			totalCost: totalCostValue,
			totalReceived: received,
			totalScheduled: scheduled,
		};
	}, [packageCost, payments, paymentSchedules, deliverables]);

	const packageCostOnly = Number.parseFloat(packageCost) || 0;
	const availableToSchedule = Math.max(packageCostOnly - totalReceived, 0);
	const amountLeftToSchedule = Math.max(
		availableToSchedule - totalScheduled,
		0,
	);
	const scheduledOverBy = Math.max(totalScheduled - availableToSchedule, 0);
	const hasScheduledOverage = scheduledOverBy > 0.0001;
	const paymentSchedulesError = form.formState.errors.paymentSchedules as
		| { message?: string }
		| undefined;

	const shootScheduleItems = shoots
		.filter((shoot) => shoot.shootType && shoot.shootDate)
		.map((shoot) => {
			const shootName = shoot.shootType
				.replace(/_/g, " ")
				.replace(/\b\w/g, (char) => char.toUpperCase());
			const isoDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(
				shoot.shootDate,
			);
			const shootDate = isoDateMatch
				? new Date(
						Date.UTC(
							Number(isoDateMatch[1]),
							Number(isoDateMatch[2]) - 1,
							Number(isoDateMatch[3]),
						),
					)
				: new Date(shoot.shootDate);
			const hasValidDate = !Number.isNaN(shootDate.getTime());
			return {
				name: shootName,
				date: hasValidDate
					? shootDate.toLocaleDateString("en-IN", {
							day: "numeric",
							month: "short",
							timeZone: "UTC",
							year: "numeric",
						})
					: shoot.shootDate,
				timestamp: hasValidDate
					? shootDate.getTime()
					: Number.MAX_SAFE_INTEGER,
			};
		})
		.sort((a, b) => a.timestamp - b.timestamp);

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

	const addNewPayment = (presetNotes?: string) => {
		appendPayment({
			amount: "",
			paymentMethod: "upi",
			receivedDate: new Date().toISOString().split("T")[0],
			transactionReference: "",
			notes: presetNotes ?? "",
			proofAttachment: null,
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
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-3 flex-wrap">
				<FormSectionHeading
					title="Payment"
					icon={BanknoteIcon}
					className="flex-1 pb-0"
				/>
				<div className="flex gap-x-3 gap-y-1 text-sm text-right">
					<div className="font-medium text-green-600 dark:text-green-400">
						{formatCurrency(totalReceived)}
					</div>
					<div className="text-muted-foreground">/</div>
					<div className="font-medium">
						{formatCurrency(totalCost)}
					</div>
				</div>
			</div>
			<Card>
				<CardContent>
					<div className="grid gap-7">
						{/* Received sub-section */}
						<FormSection>
							<div className="flex flex-wrap items-start justify-between gap-3">
								<div className="min-w-0 flex-1">
									<FormSectionHeading
										title="Received"
										icon={BanknoteIcon}
										className="pb-1"
									/>
									<FieldDescription className="text-13">
										Payments already collected from the
										client
									</FieldDescription>
								</div>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => addNewPayment()}
								>
									<PlusIcon className="mr-2 h-4 w-4" />
									Add Payment
								</Button>
							</div>
							{paymentFields.length === 0 ? (
								<div className="flex flex-col items-center gap-3 py-8 px-4 border border-dashed rounded-lg text-center">
									<BanknoteIcon className="h-10 w-10 text-muted-foreground/40" />
									<p className="text-sm text-muted-foreground">
										No payments recorded yet
									</p>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() =>
											addNewPayment("Advance Payment")
										}
									>
										<PlusIcon className="mr-1 h-3 w-3" />
										Advance Payment
									</Button>
								</div>
							) : (
								<div className="grid gap-3">
									{paymentFields.map((payment, index) => (
										<PaymentRow
											key={payment.id}
											index={index}
											onRemove={() =>
												removePayment(index)
											}
										/>
									))}
									<AddItemButton
										onClick={() => addNewPayment()}
									>
										Add another payment
									</AddItemButton>
								</div>
							)}
						</FormSection>

						{/* Scheduled sub-section */}
						<FormSection>
							<div className="flex flex-wrap items-start justify-between gap-3">
								<div className="min-w-0 flex-1">
									<FormSectionHeading
										title="Scheduled"
										icon={CalendarIcon}
										className="pb-1"
									/>
									<FieldDescription className="text-13">
										Upcoming payment milestones
									</FieldDescription>
								</div>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => addNewSchedule()}
								>
									<PlusIcon className="mr-2 h-4 w-4" />
									Add Milestone
								</Button>
							</div>
							<div className="rounded-lg border bg-muted/20 p-3">
								<div className="flex flex-wrap gap-2">
									<Badge
										variant="outline"
										className={
											hasScheduledOverage
												? "border-destructive/40 bg-destructive/10 text-destructive"
												: "border-border/70 bg-background text-foreground"
										}
									>
										Amount left •{" "}
										{formatCurrency(amountLeftToSchedule)}
									</Badge>
									{shootScheduleItems.map((item, index) => (
										<Badge
											key={`${item.name}-${item.date}-${index}`}
											variant="outline"
											className="border-border/70 bg-background text-xs font-normal"
										>
											{item.name} • {item.date}
										</Badge>
									))}
								</div>
								{paymentSchedulesError?.message && (
									<p className="mt-2 text-xs text-destructive">
										{paymentSchedulesError.message}
									</p>
								)}
							</div>
							{scheduleFields.length === 0 ? (
								<div className="flex flex-col items-center gap-3 py-8 px-4 border border-dashed rounded-lg text-center">
									<CalendarIcon className="h-10 w-10 text-muted-foreground/40" />
									<p className="text-sm text-muted-foreground">
										No payment schedule set
									</p>
									<div className="flex flex-wrap justify-center gap-2">
										{PAYMENT_SCHEDULE_PRESETS.slice(
											1,
											4,
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
							) : (
								<div className="grid gap-3">
									{scheduleFields.map((schedule, index) => (
										<ScheduleRow
											key={schedule.id}
											index={index}
											onRemove={() =>
												removeSchedule(index)
											}
										/>
									))}
									<AddItemButton
										onClick={() => addNewSchedule()}
									>
										Add another milestone
									</AddItemButton>
								</div>
							)}
						</FormSection>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

interface PaymentRowProps {
	index: number;
	onRemove: () => void;
}

function PaymentRow({ index, onRemove }: PaymentRowProps) {
	const form = useFormContext<BookingFormValues>();
	const [isUploading, setIsUploading] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Watch values to determine if there's content
	const referenceValue = form.watch(`payments.${index}.transactionReference`);
	const notesValue = form.watch(`payments.${index}.notes`);
	const proofAttachment = form.watch(`payments.${index}.proofAttachment`);
	const hasDetails = Boolean(referenceValue || notesValue || proofAttachment);

	// Track expanded state - starts expanded if has content
	const [isExpanded, setIsExpanded] = useState(hasDetails);

	// Format file size for display
	const formatFileSize = (bytes: number) => {
		if (bytes < 1024) {
			return `${bytes} B`;
		}
		if (bytes < 1024 * 1024) {
			return `${(bytes / 1024).toFixed(1)} KB`;
		}
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	};

	// Handle file upload
	const handleFileUpload = async (file: File) => {
		const validationError = validateUploadFile(file, "payments");
		if (validationError) {
			toast.error(validationError);
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
					context: "payments",
				}),
			});

			if (!presignedUrlRes.ok) {
				throw new Error(
					await getUploadResponseErrorMessage(
						presignedUrlRes,
						"Failed to get upload URL",
					),
				);
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
					`payments.${index}.proofAttachment`,
					{
						name: file.name,
						size: file.size,
						type: file.type,
						key,
						url: finalUrl,
					},
					{ shouldValidate: true },
				);
				toast.success("Proof uploaded");
			} else {
				throw new Error("Upload failed");
			}
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to upload file",
			);
		} finally {
			setIsUploading(false);
		}
	};

	// Handle file removal
	const handleFileRemove = async () => {
		if (!proofAttachment) {
			return;
		}
		setIsDeleting(true);
		try {
			const deleteRes = await fetch("/api/uploads/file", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ key: proofAttachment.key }),
			});
			if (!deleteRes.ok) {
				throw new Error("Delete failed");
			}
			form.setValue(`payments.${index}.proofAttachment`, null, {
				shouldValidate: true,
			});
			toast.success("Proof removed");
		} catch (_error) {
			toast.error("Failed to remove file");
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<ItemCard>
			<ItemCardHeader
				title={`Payment ${index + 1}`}
				onRemove={onRemove}
				removeLabel="Remove payment"
			/>

			{/* Row 1: Amount, Method, Date */}
			<FieldRow cols={3}>
				{/* Amount */}
				<CustomField
					control={form.control}
					name={`payments.${index}.amount`}
					label="Amount"
				>
					{({ field, fieldState }) => (
						<InputGroup>
							<InputGroupAddon>
								<InputGroupText>₹</InputGroupText>
							</InputGroupAddon>
							<InputGroupInput
								{...field}
								id={field.name}
								size="sm"
								placeholder="0.00"
								aria-invalid={fieldState.invalid}
								onChange={(e) => {
									const value = e.target.value.replace(
										/[^0-9.]/g,
										"",
									);
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
					)}
				</CustomField>

				{/* Payment Method */}
				<SelectField
					control={form.control}
					name={`payments.${index}.paymentMethod`}
					label="Method"
					placeholder="Select"
					options={PAYMENT_METHOD_OPTIONS.map((method) => ({
						value: method.value,
						label: method.label,
					}))}
				/>

				{/* Received Date */}
				<DateField
					control={form.control}
					name={`payments.${index}.receivedDate`}
					label="Date"
				/>
			</FieldRow>

			{/* Collapsible Details Section */}
			{isExpanded && (
				<Field>
					<div className="flex items-center justify-between">
						<FieldLabel
							variant="micro"
							htmlFor={`payments.${index}.notes`}
						>
							Reference
						</FieldLabel>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-auto py-0 px-1 text-muted-foreground"
							onClick={() => setIsExpanded(false)}
						>
							<ChevronUpIcon className="mr-1 h-3.5 w-3.5" />
							Hide
						</Button>
					</div>
					<InputGroup>
						<Controller
							name={`payments.${index}.notes`}
							control={form.control}
							render={({ field }) => (
								<InputGroupTextarea
									{...field}
									id={`payments.${index}.notes`}
									size="sm"
									placeholder="Transaction ID, notes..."
									rows={2}
								/>
							)}
						/>
						<InputGroupAddon align="block-end">
							{/* Hidden file input */}
							<input
								ref={fileInputRef}
								type="file"
								className="hidden"
								accept={PAYMENT_UPLOAD_ACCEPT}
								onChange={(e) => {
									const file = e.target.files?.[0];
									if (file) {
										handleFileUpload(file);
									}
									e.target.value = "";
								}}
							/>

							{/* Attachment button or uploaded file display */}
							{isUploading ? (
								<InputGroupText>
									<Loader2Icon className="h-4 w-4 animate-spin" />
									<span className="text-xs">
										Uploading...
									</span>
								</InputGroupText>
							) : proofAttachment ? (
								<>
									<InputGroupText className="gap-1.5">
										<FileTextIcon className="h-4 w-4 text-primary" />
										<span
											className="max-w-[150px] truncate text-xs"
											title={proofAttachment.name}
										>
											{proofAttachment.name}
										</span>
										<span className="text-xs text-muted-foreground">
											(
											{formatFileSize(
												proofAttachment.size,
											)}
											)
										</span>
									</InputGroupText>
									<InputGroupButton
										variant="ghost"
										size="icon-xs"
										onClick={handleFileRemove}
										disabled={isDeleting}
										className="text-destructive hover:text-destructive"
									>
										{isDeleting ? (
											<Loader2Icon className="h-3.5 w-3.5 animate-spin" />
										) : (
											<XIcon className="h-3.5 w-3.5" />
										)}
										<span className="sr-only">
											Remove proof
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
									Attach Proof
								</InputGroupButton>
							)}

							<Separator
								orientation="vertical"
								className="!h-4 ml-auto"
							/>

							<InputGroupText className="text-xs text-muted-foreground">
								{PAYMENT_UPLOAD_HELPER_TEXT}
							</InputGroupText>
						</InputGroupAddon>
					</InputGroup>
				</Field>
			)}

			{/* Add Details button (when details hidden) */}
			{!isExpanded && (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="w-fit text-muted-foreground"
					onClick={() => setIsExpanded(true)}
				>
					<ChevronDownIcon className="mr-1.5 h-3.5 w-3.5" />
					Add reference
				</Button>
			)}
		</ItemCard>
	);
}

interface ScheduleRowProps {
	index: number;
	onRemove: () => void;
}

function ScheduleRow({ index, onRemove }: ScheduleRowProps) {
	const form = useFormContext<BookingFormValues>();

	// Watch notes to determine if there's content
	const notesValue = form.watch(`paymentSchedules.${index}.notes`);

	// Track expanded state - starts expanded if has content
	const [isExpanded, setIsExpanded] = useState(Boolean(notesValue));

	return (
		<ItemCard>
			<ItemCardHeader
				title={`Milestone ${index + 1}`}
				onRemove={onRemove}
				removeLabel="Remove milestone"
			/>

			{/* Row 1: Name, Amount, Due Date */}
			<FieldRow cols={3}>
				{/* Name */}
				<CustomField
					control={form.control}
					name={`paymentSchedules.${index}.name`}
					label="Payment Name"
				>
					{({ field, fieldState }) => (
						<>
							<Input
								{...field}
								id={field.name}
								size="sm"
								placeholder="e.g. Advance Payment"
								list={`schedule-presets-${index}`}
								autoComplete="off"
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
						</>
					)}
				</CustomField>

				{/* Amount */}
				<CustomField
					control={form.control}
					name={`paymentSchedules.${index}.amount`}
					label="Amount"
				>
					{({ field, fieldState }) => (
						<InputGroup>
							<InputGroupAddon>
								<InputGroupText>₹</InputGroupText>
							</InputGroupAddon>
							<InputGroupInput
								{...field}
								id={field.name}
								size="sm"
								placeholder="0.00"
								aria-invalid={fieldState.invalid}
								onChange={(e) => {
									const value = e.target.value.replace(
										/[^0-9.]/g,
										"",
									);
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
					)}
				</CustomField>

				{/* Due Date */}
				<DateField
					control={form.control}
					name={`paymentSchedules.${index}.dueDate`}
					label="Due Date"
				/>
			</FieldRow>

			{/* Collapsible Notes Section */}
			{isExpanded && (
				<Controller
					name={`paymentSchedules.${index}.notes`}
					control={form.control}
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid}>
							<div className="flex items-center justify-between">
								<FieldLabel
									variant="micro"
									htmlFor={field.name}
								>
									Notes
								</FieldLabel>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="h-auto py-0 px-1 text-muted-foreground"
									onClick={() => setIsExpanded(false)}
								>
									<ChevronUpIcon className="mr-1 h-3.5 w-3.5" />
									Hide
								</Button>
							</div>
							<InputGroup>
								<InputGroupTextarea
									{...field}
									id={field.name}
									size="sm"
									placeholder="Add notes about this milestone..."
									rows={2}
								/>
							</InputGroup>
							{fieldState.invalid && (
								<FieldError errors={[fieldState.error]} />
							)}
						</Field>
					)}
				/>
			)}

			{/* Add Notes button (when notes hidden) */}
			{!isExpanded && (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="w-fit text-muted-foreground"
					onClick={() => setIsExpanded(true)}
				>
					<ChevronDownIcon className="mr-1.5 h-3.5 w-3.5" />
					Add notes
				</Button>
			)}
		</ItemCard>
	);
}
