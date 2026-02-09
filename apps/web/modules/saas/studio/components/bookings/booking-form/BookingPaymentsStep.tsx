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
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
	InputGroupText,
	InputGroupTextarea,
} from "@repo/ui/components/input-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Separator } from "@repo/ui/components/separator";
import {
	BanknoteIcon,
	CalendarIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	FileTextIcon,
	Loader2Icon,
	PaperclipIcon,
	PlusIcon,
	TrashIcon,
	WalletIcon,
	XIcon,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import { toast } from "sonner";
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
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => addNewPayment()}
							>
								<PlusIcon className="mr-2 h-4 w-4" />
								Add Payment
							</Button>
						</Field>
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
									onClick={() => addNewPayment()}
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
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => addNewSchedule()}
							>
								<PlusIcon className="mr-2 h-4 w-4" />
								Add Milestone
							</Button>
						</Field>
						{scheduleFields.length === 0 ? (
							<div className="flex flex-col items-center gap-3 py-8 px-4 border border-dashed rounded-lg text-center">
								<CalendarIcon className="h-10 w-10 text-muted-foreground/40" />
								<p className="text-sm text-muted-foreground">
									No payment schedule set
								</p>
								<div className="flex flex-wrap justify-center gap-2">
									{PAYMENT_SCHEDULE_PRESETS.slice(1, 4).map(
										(preset) => (
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
										),
									)}
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
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	};

	// Handle file upload
	const handleFileUpload = async (file: File) => {
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

			if (!presignedUrlRes.ok)
				throw new Error("Failed to get upload URL");

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
		} catch (_error) {
			toast.error("Failed to upload file");
		} finally {
			setIsUploading(false);
		}
	};

	// Handle file removal
	const handleFileRemove = async () => {
		if (!proofAttachment) return;
		setIsDeleting(true);
		try {
			const deleteRes = await fetch("/api/uploads/file", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ key: proofAttachment.key }),
			});
			if (!deleteRes.ok) throw new Error("Delete failed");
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
			<div className="p-4 space-y-3">
				{/* Row 1: Amount, Method, Date */}
				<div className="grid gap-3 grid-cols-2 md:grid-cols-3">
					{/* Amount */}
					<Controller
						name={`payments.${index}.amount`}
						control={form.control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid}>
								<FieldLabel htmlFor={field.name}>
									Amount
								</FieldLabel>
								<InputGroup>
									<InputGroupAddon>
										<InputGroupText>₹</InputGroupText>
									</InputGroupAddon>
									<InputGroupInput
										{...field}
										id={field.name}
										placeholder="0.00"
										aria-invalid={fieldState.invalid}
										onChange={(e) => {
											const value =
												e.target.value.replace(
													/[^0-9.]/g,
													"",
												);
											const parts = value.split(".");
											if (parts.length > 2) return;
											if (parts[1] && parts[1].length > 2)
												return;
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
				</div>

				{/* Collapsible Details Section */}
				{isExpanded && (
					<Field>
						<div className="flex items-center justify-between">
							<FieldLabel
								htmlFor={`payments.${index}.notes`}
								className="text-muted-foreground"
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
									accept=".pdf,.jpg,.jpeg,.png,.webp"
									onChange={(e) => {
										const file = e.target.files?.[0];
										if (file) handleFileUpload(file);
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
									PDF or Image
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

	// Watch notes to determine if there's content
	const notesValue = form.watch(`paymentSchedules.${index}.notes`);

	// Track expanded state - starts expanded if has content
	const [isExpanded, setIsExpanded] = useState(Boolean(notesValue));

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
			<div className="p-4 space-y-3">
				{/* Row 1: Name, Amount, Due Date */}
				<div className="grid gap-3 grid-cols-2 md:grid-cols-3">
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
								<InputGroup>
									<InputGroupAddon>
										<InputGroupText>₹</InputGroupText>
									</InputGroupAddon>
									<InputGroupInput
										{...field}
										id={field.name}
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
								</InputGroup>
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
				</div>

				{/* Collapsible Notes Section */}
				{isExpanded && (
					<Controller
						name={`paymentSchedules.${index}.notes`}
						control={form.control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid}>
								<div className="flex items-center justify-between">
									<FieldLabel
										htmlFor={field.name}
										className="text-muted-foreground"
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
			</div>
		</div>
	);
}
