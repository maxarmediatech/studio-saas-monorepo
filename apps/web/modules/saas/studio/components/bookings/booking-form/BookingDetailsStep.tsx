"use client";

import { Button } from "@repo/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldSet,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
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
import { useQuery } from "@tanstack/react-query";
import {
	ClipboardListIcon,
	FileTextIcon,
	Loader2Icon,
	PaperclipIcon,
	PlusIcon,
	TrashIcon,
	UserPlusIcon,
	UsersIcon,
	XIcon,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import { toast } from "sonner";
import { bookingFormQueries } from "./booking-form-queries";
import type { BookingFormValues } from "./booking-form-schema";
import { CreateClientDialog } from "./create-client-dialog";

export function BookingDetailsStep() {
	const form = useFormContext<BookingFormValues>();
	const [
		createClientForParticipantIndex,
		setCreateClientForParticipantIndex,
	] = useState<number | null>(null);
	const [isUploading, setIsUploading] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Watch attachment field
	const contractAttachment = form.watch("contractAttachment");

	// Fetch configurations using centralized query options
	const { data: bookingTypesData } = useQuery(
		bookingFormQueries.bookingTypes(),
	);
	const { data: packageTypesData } = useQuery(
		bookingFormQueries.packageTypes(),
	);
	const { data: relationTypesData } = useQuery(
		bookingFormQueries.relationTypes(),
	);
	const { data: clientsData } = useQuery(bookingFormQueries.clients());

	// Use real data from API
	const bookingTypes = bookingTypesData?.data ?? [];
	const packageTypes = packageTypesData?.data ?? [];
	const relationTypes = relationTypesData?.data ?? [];
	const clients = clientsData?.data ?? [];

	const {
		fields: participants,
		append: appendParticipant,
		remove: removeParticipant,
	} = useFieldArray({
		control: form.control,
		name: "participants",
	});

	const selectedBookingType = form.watch("bookingType");
	const watchedParticipants = form.watch("participants");

	// Track which client IDs are already selected (for duplicate prevention)
	const selectedClientIds = useMemo(() => {
		return new Set(
			watchedParticipants
				?.map((p) => p.clientId)
				.filter((id) => id && id.length > 0) ?? [],
		);
	}, [watchedParticipants]);

	// Filter package types by booking type if metadata specifies it
	const filteredPackageTypes = packageTypes.filter((pkg) => {
		if (!selectedBookingType) {
			return true;
		}
		const bookingTypeMetadata = pkg.metadata as {
			bookingType?: string;
		} | null;
		return (
			!bookingTypeMetadata?.bookingType ||
			bookingTypeMetadata.bookingType === selectedBookingType
		);
	});

	// Handle package selection - auto-fill cost
	const handlePackageChange = (value: string) => {
		form.setValue("packageType", value);
		const selectedPackage = packageTypes.find((p) => p.key === value);
		if (selectedPackage?.metadata) {
			const metadata = selectedPackage.metadata as {
				defaultCost?: string;
			};
			if (metadata.defaultCost) {
				form.setValue("packageCost", metadata.defaultCost);
			}
		}
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
					{ shouldValidate: true },
				);
				toast.success("Document uploaded successfully");
			} else {
				throw new Error("Upload failed");
			}
		} catch (error) {
			toast.error("Failed to upload file");
		} finally {
			setIsUploading(false);
		}
	};

	// Handle file removal
	const handleFileRemove = async () => {
		if (!contractAttachment) return;
		setIsDeleting(true);
		try {
			await fetch("/api/uploads/file", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ key: contractAttachment.key }),
			});
			form.setValue("contractAttachment", null, { shouldValidate: true });
			toast.success("Document removed");
		} catch (error) {
			toast.error("Failed to remove file");
		} finally {
			setIsDeleting(false);
		}
	};

	// Format file size for display
	const formatFileSize = (bytes: number) => {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	};

	return (
		<FieldGroup className="gap-6">
			<CreateClientDialog
				open={createClientForParticipantIndex !== null}
				onOpenChange={(open) => {
					if (!open) {
						setCreateClientForParticipantIndex(null);
					}
				}}
				onCreated={(clientId) => {
					if (createClientForParticipantIndex === null) {
						return;
					}

					form.setValue(
						`participants.${createClientForParticipantIndex}.clientId`,
						clientId,
						{ shouldDirty: true, shouldValidate: true },
					);
					setCreateClientForParticipantIndex(null);
				}}
			/>

			{/* Booking Information Section */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<ClipboardListIcon className="h-5 w-5" />
						Booking Detail
					</CardTitle>
					<p className="text-sm text-muted-foreground">
						Enter the basic details for this booking
					</p>
				</CardHeader>
				<CardContent>
					<FieldGroup className="gap-4">
						{/* Row 1: Booking Name (2/3) + Booking Type (1/3) */}
						<div className="grid gap-4 md:grid-cols-3">
							{/* Booking Name - wider to accommodate long names */}
							<div className="md:col-span-2">
								<Controller
								name="name"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={field.name}>
											Booking Name
										</FieldLabel>
										<Input
											{...field}
											id={field.name}
											placeholder="e.g. John & Jane Wedding"
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

							{/* Booking Type */}
							<Controller
								name="bookingType"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={field.name}>
											Booking Type
										</FieldLabel>
										<Select
											onValueChange={field.onChange}
											value={field.value}
										>
											<SelectTrigger
												id={field.name}
												aria-invalid={
													fieldState.invalid
												}
											>
												<SelectValue placeholder="Select type" />
											</SelectTrigger>
											<SelectContent>
												{bookingTypes.map((type) => (
													<SelectItem
														key={type.id}
														value={type.key}
													>
														{type.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										{fieldState.invalid && (
											<FieldError
												errors={[fieldState.error]}
											/>
										)}
									</Field>
								)}
							/>
						</div>

						{/* Row 2: Package Type + Package Cost */}
						<div className="grid gap-4 md:grid-cols-2">
							{/* Package Type */}
							<Controller
								name="packageType"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={field.name}>
											Package
										</FieldLabel>
										<Select
											onValueChange={handlePackageChange}
											value={field.value}
											disabled={!selectedBookingType}
										>
											<SelectTrigger
												id={field.name}
												aria-invalid={
													fieldState.invalid
												}
											>
												<SelectValue placeholder="Select package" />
											</SelectTrigger>
											<SelectContent>
												{filteredPackageTypes.length >
												0 ? (
													filteredPackageTypes.map(
														(pkg) => (
															<SelectItem
																key={pkg.id}
																value={pkg.key}
															>
																{pkg.label}
															</SelectItem>
														),
													)
												) : (
													<div className="p-2 text-sm text-muted-foreground text-center">
														No packages found
													</div>
												)}
											</SelectContent>
										</Select>
										{fieldState.invalid && (
											<FieldError
												errors={[fieldState.error]}
											/>
										)}
									</Field>
								)}
							/>

							{/* Package Cost */}
							<Controller
								name="packageCost"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={field.name}>
											Package Cost
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
												disabled={!selectedBookingType}
												aria-invalid={
													fieldState.invalid
												}
												onChange={(e) => {
													// Allow only numbers and decimal point
													const value =
														e.target.value.replace(
															/[^0-9.]/g,
															"",
														);
													// Prevent multiple decimal points
													const parts =
														value.split(".");
													if (parts.length > 2) {
														return;
													}
													// Limit to 2 decimal places
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
											<FieldError
												errors={[fieldState.error]}
											/>
										)}
									</Field>
								)}
							/>
						</div>

						{/* Row 3: Notes with Contract Attachment */}
						<Controller
							name="note"
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor={field.name}>
										Notes & Documents
									</FieldLabel>
									<InputGroup>
										<InputGroupTextarea
											{...field}
											id={field.name}
											placeholder="Add any booking specific notes or requests..."
											rows={3}
											aria-invalid={fieldState.invalid}
										/>
										<InputGroupAddon align="block-end">
											{/* Hidden file input */}
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

											{/* Attachment button or uploaded file display */}
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
				</CardContent>
			</Card>

			{/* Participants Section */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							<UsersIcon className="h-5 w-5" />
							Participants
						</CardTitle>
						<p className="text-sm text-muted-foreground mt-1">
							Add clients associated with this booking
						</p>
					</div>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() =>
							appendParticipant({
								clientId: "",
								role: "",
							})
						}
					>
						<PlusIcon className="mr-2 h-4 w-4" />
						Add Participant
					</Button>
				</CardHeader>
				<CardContent>
					<FieldSet>
						{participants.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-12 text-center border border-dashed rounded-lg">
								<UserPlusIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
								<p className="text-sm text-muted-foreground mb-4">
									No participants added yet. Click "Add
									Participant" to add clients to this booking.
								</p>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() =>
										appendParticipant({
											clientId: "",
											role: "",
										})
									}
								>
									<PlusIcon className="mr-2 h-4 w-4" />
									Add Participant
								</Button>
							</div>
						) : (
							<FieldGroup className="gap-4">
								{participants.map((field, index) => (
									<Card key={field.id} className="p-4">
										<div className="flex flex-col md:flex-row md:items-start gap-4">
											<div className="flex-1 grid gap-4 grid-cols-1 md:grid-cols-2">
												{/* Client Select */}
												<Controller
													name={`participants.${index}.clientId`}
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
																htmlFor={
																	field.name
																}
															>
																Client
															</FieldLabel>
															<Select
																onValueChange={
																	field.onChange
																}
																value={
																	field.value
																}
															>
																<SelectTrigger
																	id={
																		field.name
																	}
																	aria-invalid={
																		fieldState.invalid
																	}
																>
																	<SelectValue placeholder="Select client" />
																</SelectTrigger>
																<SelectContent>
																	{clients.length >
																	0 ? (
																		clients.map(
																			(
																				client,
																			) => {
																				// Disable if already selected by another participant
																				const isAlreadySelected =
																					selectedClientIds.has(
																						client.id,
																					) &&
																					field.value !==
																						client.id;
																				return (
																					<SelectItem
																						key={
																							client.id
																						}
																						value={
																							client.id
																						}
																						disabled={
																							isAlreadySelected
																						}
																					>
																						<div className="flex flex-col">
																							<span>
																								{
																									client.name
																								}
																								{isAlreadySelected && (
																									<span className="ml-2 text-xs text-muted-foreground">
																										(already
																										added)
																									</span>
																								)}
																							</span>
																							{client.phoneNumber && (
																								<span className="text-xs text-muted-foreground">
																									{
																										client.phoneNumber
																									}
																								</span>
																							)}
																						</div>
																					</SelectItem>
																				);
																			},
																		)
																	) : (
																		<div className="p-2 space-y-2 text-center">
																			<p className="text-sm text-muted-foreground">
																				No
																				clients
																				found
																			</p>
																			<Button
																				type="button"
																				variant="outline"
																				size="sm"
																				onClick={(
																					e,
																				) => {
																					e.preventDefault();
																					e.stopPropagation();
																					setCreateClientForParticipantIndex(
																						index,
																					);
																				}}
																			>
																				Create
																				client
																			</Button>
																		</div>
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

												{/* Role Select */}
												<Controller
													name={`participants.${index}.role`}
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
																htmlFor={
																	field.name
																}
															>
																Role
															</FieldLabel>
															<Select
																onValueChange={
																	field.onChange
																}
																value={
																	field.value
																}
															>
																<SelectTrigger
																	id={
																		field.name
																	}
																	aria-invalid={
																		fieldState.invalid
																	}
																>
																	<SelectValue placeholder="Select role" />
																</SelectTrigger>
																<SelectContent>
																	{relationTypes.map(
																		(
																			type,
																		) => (
																			<SelectItem
																				key={
																					type.id
																				}
																				value={
																					type.key
																				}
																			>
																				{
																					type.label
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

											{/* Remove Button - 44px touch target (WCAG 2.5.5) */}
											<Button
												type="button"
												variant="ghost"
												size="icon"
												className="self-end md:self-auto md:mt-8 min-h-11 min-w-11 text-destructive hover:text-destructive hover:bg-destructive/10"
												onClick={() =>
													removeParticipant(index)
												}
												disabled={
													participants.length <= 1
												}
											>
												<TrashIcon className="h-4 w-4" />
												<span className="sr-only">
													Remove participant
												</span>
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
