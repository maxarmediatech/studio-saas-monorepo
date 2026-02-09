"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Combobox } from "@repo/ui/components/combobox";
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
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { Separator } from "@repo/ui/components/separator";
import { configurationsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { FileTextIcon, Loader2Icon, PaperclipIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { FormActions } from "../ui/FormActions";

const uploadedAttachmentSchema = z.object({
	name: z.string(),
	size: z.number(),
	type: z.string(),
	key: z.string(),
	url: z.string(),
});

const bookingEditFormSchema = z.object({
	name: z.string().min(1, "Name is required").max(255),
	packageCost: z.string().min(1, "Package cost is required"),
	note: z.string().max(5000).optional().or(z.literal("")),
	contractAttachment: uploadedAttachmentSchema.nullable().optional(),
});

export type BookingEditFormValues = z.infer<typeof bookingEditFormSchema>;

interface BookingEditFormProps {
	defaultValues?: {
		name: string;
		bookingType: string;
		packageType: string;
		packageCost: string;
		note: string | null;
		contractAttachment: {
			name: string;
			size: number;
			type: string;
			key: string;
			url: string;
		} | null;
	};
	onSubmit: (data: BookingEditFormValues) => Promise<void>;
	isPending?: boolean;
	onScrollChange?: (isScrolled: boolean) => void;
}

function formatFileSize(bytes: number) {
	if (bytes < 1024) {
		return `${bytes} B`;
	}
	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`;
	}
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BookingEditForm({
	defaultValues,
	onSubmit,
	isPending = false,
	onScrollChange,
}: BookingEditFormProps) {
	const form = useForm<BookingEditFormValues>({
		resolver: zodResolver(bookingEditFormSchema),
		defaultValues: {
			name: "",
			packageCost: "",
			note: "",
			contractAttachment: null,
		},
	});

	const [isUploading, setIsUploading] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const contractAttachment = form.watch("contractAttachment");

	const { data: bookingTypesData } = useQuery(
		configurationsApi.bookingTypesOptions(),
	);
	const { data: packageTypesData } = useQuery(
		configurationsApi.packageTypesOptions(),
	);

	useEffect(() => {
		if (defaultValues) {
			form.reset({
				name: defaultValues.name,
				packageCost: defaultValues.packageCost,
				note: defaultValues.note ?? "",
				contractAttachment: defaultValues.contractAttachment,
			});
		}
	}, [defaultValues, form]);

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
					context: "contracts",
				}),
			});

			if (!presignedUrlRes.ok) {
				throw new Error("Failed to get upload URL");
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
					"contractAttachment",
					{
						name: file.name,
						size: file.size,
						type: file.type,
						key: key,
						url: finalUrl,
					},
					{ shouldValidate: true, shouldDirty: true },
				);
				toast.success("Document uploaded successfully");
			} else {
				throw new Error("Upload failed");
			}
		} catch {
			toast.error("Failed to upload file");
		} finally {
			setIsUploading(false);
		}
	};

	const handleFileRemove = async () => {
		const currentAttachment = form.getValues("contractAttachment");
		if (!currentAttachment) {
			return;
		}
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
			form.setValue("contractAttachment", null, {
				shouldValidate: true,
				shouldDirty: true,
			});
			toast.success("Document removed");
		} catch {
			toast.error("Failed to remove file");
		} finally {
			setIsDeleting(false);
		}
	};

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
						<Field>
							<FieldLabel>Booking Type</FieldLabel>
							<Combobox
								options={(bookingTypesData?.data ?? []).map(
									(type) => ({
										value: type.key,
										label: type.label,
									}),
								)}
								value={defaultValues?.bookingType ?? ""}
								onValueChange={() => {}}
								placeholder="—"
								disabled={true}
							/>
						</Field>

						<Field>
							<FieldLabel>Package</FieldLabel>
							<Combobox
								options={(packageTypesData?.data ?? []).map(
									(pkg) => ({
										value: pkg.key,
										label: pkg.label,
									}),
								)}
								value={defaultValues?.packageType ?? ""}
								onValueChange={() => {}}
								placeholder="—"
								disabled={true}
							/>
						</Field>

						<Controller
							name="name"
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor={field.name}>
										Booking Name *
									</FieldLabel>
									<Input
										{...field}
										id={field.name}
										placeholder="Enter booking name"
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
							name="packageCost"
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor={field.name}>
										Package Cost *
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
										<FieldError
											errors={[fieldState.error]}
										/>
									)}
								</Field>
							)}
						/>

						<Controller
							name="note"
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor={field.name}>
										Requests or References
									</FieldLabel>
									<InputGroup>
										<InputGroupTextarea
											{...field}
											id={field.name}
											placeholder="Add any booking specific requests or references..."
											rows={3}
											aria-invalid={fieldState.invalid}
										/>
										<InputGroupAddon align="block-end">
											<input
												ref={fileInputRef}
												type="file"
												className="hidden"
												accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
												onChange={(e) => {
													const file =
														e.target.files?.[0];
													if (file) {
														handleFileUpload(file);
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
											) : contractAttachment ? (
												<>
													<InputGroupText className="gap-1.5">
														<FileTextIcon className="h-4 w-4 text-primary" />
														<span
															className="max-w-[200px] truncate text-xs"
															title={
																contractAttachment.name
															}
														>
															{
																contractAttachment.name
															}
														</span>
														<span className="text-xs text-muted-foreground">
															(
															{formatFileSize(
																contractAttachment.size,
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
														disabled={isDeleting}
														className="text-destructive hover:text-destructive"
													>
														{isDeleting ? (
															<Loader2Icon className="h-3.5 w-3.5 animate-spin" />
														) : (
															<XIcon className="h-3.5 w-3.5" />
														)}
														<span className="sr-only">
															Remove file
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
													Attach Document
												</InputGroupButton>
											)}

											<Separator
												orientation="vertical"
												className="!h-4 ml-auto"
											/>

											<InputGroupText className="text-xs text-muted-foreground">
												PDF, DOC, or Image
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
	);
}
