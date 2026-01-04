"use client";

import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Combobox } from "@repo/ui/components/combobox";
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
	InputGroupText,
	InputGroupTextarea,
} from "@repo/ui/components/input-group";
import { Separator } from "@repo/ui/components/separator";
import { useClientCallback } from "@saas/studio/hooks/params/client-callback-context";
import { useClientParams } from "@saas/studio/hooks/params/use-client-params";
import { useConfigurationParams } from "@saas/studio/hooks/params/use-configuration-params";
import { useQuery } from "@tanstack/react-query";
import {
	FileTextIcon,
	Loader2Icon,
	PaperclipIcon,
	PlusIcon,
	TrashIcon,
	UserPlusIcon,
	UsersIcon,
	XIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import { toast } from "sonner";
import { bookingFormQueries } from "./booking-form-queries";
import type { BookingFormValues } from "./booking-form-schema";

export function BookingDetailsStep() {
	const form = useFormContext<BookingFormValues>();
	const [isUploading, setIsUploading] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isNameManuallyEdited, setIsNameManuallyEdited] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// URL-based configuration sheet params (for "Create New..." actions)
	const { openCreate: openCreateConfiguration } = useConfigurationParams();
	const { openCreate: openCreateClient } = useClientParams();
	const { registerCallback } = useClientCallback();

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
	const { data: clientsData, refetch: refetchClients } = useQuery(
		bookingFormQueries.clients(),
	);

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

	const handleAddParticipant = useCallback(() => {
		const currentParticipants = form.getValues("participants") ?? [];
		const incompleteIndex = currentParticipants.findIndex(
			(participant) => !participant?.clientId || !participant?.role,
		);

		if (incompleteIndex !== -1) {
			const missingField = !currentParticipants[incompleteIndex]?.clientId
				? "clientId"
				: "role";

			toast.warning(
				"Please complete the current client before adding another.",
			);
			form.setFocus(
				`participants.${incompleteIndex}.${missingField}` as never,
			);
			return;
		}

		appendParticipant({
			clientId: "",
			role: "",
		});
	}, [appendParticipant, form]);

	const handleCreateNewClient = useCallback(
		(preferredIndex?: number) => {
			registerCallback((clientId: string) => {
				void refetchClients();

				const currentParticipants =
					form.getValues("participants") ?? [];
				if (
					typeof preferredIndex === "number" &&
					currentParticipants[preferredIndex] &&
					!currentParticipants[preferredIndex]?.clientId
				) {
					form.setValue(
						`participants.${preferredIndex}.clientId`,
						clientId,
						{
							shouldDirty: true,
							shouldValidate: true,
						},
					);
					form.setFocus(
						`participants.${preferredIndex}.role` as never,
					);
					return;
				}

				const firstEmptyClientIndex = currentParticipants.findIndex(
					(participant) => !participant?.clientId,
				);

				if (firstEmptyClientIndex !== -1) {
					form.setValue(
						`participants.${firstEmptyClientIndex}.clientId`,
						clientId,
						{
							shouldDirty: true,
							shouldValidate: true,
						},
					);
					form.setFocus(
						`participants.${firstEmptyClientIndex}.role` as never,
					);
					return;
				}

				appendParticipant({
					clientId,
					role: "",
				});
				form.setFocus(
					`participants.${currentParticipants.length}.role` as never,
				);
			});

			openCreateClient();
		},
		[
			appendParticipant,
			form,
			openCreateClient,
			refetchClients,
			registerCallback,
		],
	);

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

	// Filter relation types (roles) by bi-directional relationship
	// A role appears if:
	// 1. The booking type includes this role in metadata.roles, OR
	// 2. The role includes this booking type in metadata.bookingTypes, OR
	// 3. Neither has any configuration (backwards compatible)
	const filteredRoleOptions = useMemo(() => {
		if (!selectedBookingType) {
			return relationTypes; // No booking type → show all roles
		}

		// Get booking type's configured roles
		const bookingTypeConfig = bookingTypes.find(
			(bt) => bt.key === selectedBookingType,
		);
		const bookingTypeRoles = (
			bookingTypeConfig?.metadata as {
				roles?: string[];
			} | null
		)?.roles;

		// Filter roles that match EITHER direction
		return relationTypes.filter((role) => {
			// Check if booking type includes this role
			const bookingTypeAllowsRole = bookingTypeRoles?.includes(role.key);

			// Check if role includes this booking type
			const roleBookingTypes = (
				role.metadata as {
					bookingTypes?: string[];
				} | null
			)?.bookingTypes;
			const roleAllowsBookingType =
				roleBookingTypes?.includes(selectedBookingType);

			// If neither has configuration, show the role (backwards compatible)
			const neitherConfigured =
				!bookingTypeRoles?.length && !roleBookingTypes?.length;

			return (
				bookingTypeAllowsRole ||
				roleAllowsBookingType ||
				neitherConfigured
			);
		});
	}, [selectedBookingType, bookingTypes, relationTypes]);

	// Track previous booking type to detect changes
	const prevBookingTypeRef = useRef<string | undefined>(undefined);

	// Warn when booking type changes and existing client roles become invalid
	useEffect(() => {
		// Skip initial render and when booking type is cleared
		if (!selectedBookingType || prevBookingTypeRef.current === undefined) {
			prevBookingTypeRef.current = selectedBookingType;
			return;
		}

		// Only run when booking type actually changes
		if (prevBookingTypeRef.current === selectedBookingType) {
			return;
		}
		prevBookingTypeRef.current = selectedBookingType;

		// Get booking type's configured roles
		const bookingTypeConfig = bookingTypes.find(
			(bt) => bt.key === selectedBookingType,
		);
		const bookingTypeRoles = (
			bookingTypeConfig?.metadata as {
				roles?: string[];
			} | null
		)?.roles;

		// Check if any existing participants have now-invalid roles (using bi-directional logic)
		const invalidParticipants = watchedParticipants?.filter((p) => {
			if (!p.role) {
				return false;
			}

			// Find the role configuration
			const roleConfig = relationTypes.find((rt) => rt.key === p.role);
			const roleBookingTypes = (
				roleConfig?.metadata as {
					bookingTypes?: string[];
				} | null
			)?.bookingTypes;

			// Check if role is allowed via either direction
			const bookingTypeAllowsRole = bookingTypeRoles?.includes(p.role);
			const roleAllowsBookingType =
				roleBookingTypes?.includes(selectedBookingType);
			const neitherConfigured =
				!bookingTypeRoles?.length && !roleBookingTypes?.length;

			// Role is INVALID if it's not allowed via any path
			return !(
				bookingTypeAllowsRole ||
				roleAllowsBookingType ||
				neitherConfigured
			);
		});

		if (invalidParticipants && invalidParticipants.length > 0) {
			toast.warning(
				`${invalidParticipants.length} client(s) have roles not applicable to this booking type. Please update their roles.`,
			);
		}
	}, [selectedBookingType, bookingTypes, relationTypes, watchedParticipants]);

	// Generate booking name from clients and booking type
	const generateBookingName = useCallback(() => {
		if (isNameManuallyEdited) {
			// Don't override manual edits
			return;
		}

		const clientNames = watchedParticipants
			?.map((p) => clients.find((c) => c.id === p.clientId)?.name)
			.filter((name): name is string => Boolean(name));

		if (!clientNames?.length) {
			return;
		}

		const bookingTypeLabel =
			bookingTypes.find((bt) => bt.key === selectedBookingType)?.label ??
			"";

		// Format: "John Smith & Jane Doe Wedding"
		const namesJoined = clientNames.join(" & ");
		const generatedName = bookingTypeLabel
			? `${namesJoined} ${bookingTypeLabel}`
			: namesJoined;

		form.setValue("name", generatedName, { shouldDirty: false });
	}, [
		watchedParticipants,
		selectedBookingType,
		clients,
		bookingTypes,
		isNameManuallyEdited,
		form,
	]);

	// Trigger name generation when clients or booking type change
	useEffect(() => {
		generateBookingName();
	}, [generateBookingName]);

	// Handle package selection - auto-fill cost and deliverables
	const handlePackageChange = (value: string) => {
		form.setValue("packageType", value);
		const selectedPackage = packageTypes.find((p) => p.key === value);
		if (selectedPackage?.metadata) {
			const metadata = selectedPackage.metadata as {
				defaultCost?: string;
				defaultDeliverables?: Array<{
					title: string;
					deliverableType: string;
					quantity: number;
				}>;
			};

			// Auto-fill package cost
			if (metadata.defaultCost) {
				form.setValue("packageCost", metadata.defaultCost);
			}

			// Auto-populate deliverables from package (replaces all existing per design decision)
			if (
				metadata.defaultDeliverables &&
				metadata.defaultDeliverables.length > 0
			) {
				const packageDeliverables = metadata.defaultDeliverables.map(
					(d) => ({
						name: d.title,
						deliverableType: d.deliverableType,
						quantity: d.quantity,
						isPackageIncluded: true,
						description: "",
						dueDate: "",
						crewAssignments: [],
					}),
				);
				form.setValue("deliverables", packageDeliverables, {
					shouldDirty: true,
				});
				toast.info(
					`${packageDeliverables.length} deliverables added from package`,
				);
			} else {
				// Clear deliverables if package has none
				form.setValue("deliverables", [], { shouldDirty: true });
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
		} catch (_error) {
			toast.error("Failed to upload file");
		} finally {
			setIsUploading(false);
		}
	};

	// Handle file removal
	const handleFileRemove = async () => {
		if (!contractAttachment) {
			return;
		}
		setIsDeleting(true);
		try {
			const deleteRes = await fetch("/api/uploads/file", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ key: contractAttachment.key }),
			});
			if (!deleteRes.ok) {
				throw new Error("Delete failed");
			}
			form.setValue("contractAttachment", null, { shouldValidate: true });
			toast.success("Document removed");
		} catch (_error) {
			toast.error("Failed to remove file");
		} finally {
			setIsDeleting(false);
		}
	};

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

	return (
		<Card className="shadow-none">
			<CardContent>
				<FieldSet>
					<FieldLegend>Booking Details</FieldLegend>
					<FieldDescription>
						Enter the details for this booking
					</FieldDescription>
					<FieldSeparator />
					<FieldGroup>
						{/* Section 1: Booking Type (context setter) */}
						<Controller
							name="bookingType"
							control={form.control}
							render={({ field, fieldState }) => (
								<Field
									orientation="responsive"
									data-invalid={fieldState.invalid}
								>
									<div className="flex-1">
										<FieldContent>
											<FieldLabel htmlFor={field.name}>
												Booking Type
											</FieldLabel>
											<FieldDescription>
												Select the type of booking
												session
											</FieldDescription>
										</FieldContent>
									</div>
									<div className="w-full md:min-w-[320px]   md:shrink-0">
										<Combobox
											id={field.name}
											options={bookingTypes.map(
												(type) => ({
													value: type.key,
													label: type.label,
												}),
											)}
											value={field.value}
											onValueChange={field.onChange}
											placeholder="Select type..."
											searchPlaceholder="Search types..."
											emptyText="No booking types found."
											aria-invalid={fieldState.invalid}
											onCreate={{
												label: "Add Booking Type...",
												onClick: () =>
													openCreateConfiguration(
														"booking_type",
													),
											}}
										/>
										{fieldState.invalid && (
											<FieldError
												errors={[fieldState.error]}
											/>
										)}
									</div>
								</Field>
							)}
						/>

						<FieldSeparator />

						{/* Section 2: Clients */}
						<Field orientation="responsive">
							<div className="flex-1">
								<FieldContent>
									<FieldTitle className="flex items-center gap-2">
										<UsersIcon className="h-4 w-4" />
										Clients
									</FieldTitle>
									<FieldDescription>
										Add clients associated with this booking
									</FieldDescription>
								</FieldContent>
							</div>
							<Button
								type="button"
								variant="secondary"
								size="sm"
								onClick={() => handleCreateNewClient()}
							>
								<PlusIcon className="mr-1.5 h-3.5 w-3.5" />
								Add new client
							</Button>
						</Field>
						<FieldSet>
							{participants.length === 0 ? (
								<div className="flex items-center gap-3 py-6 px-4 border border-dashed rounded-lg">
									<UserPlusIcon className="h-8 w-8 text-muted-foreground/50 shrink-0" />
									<div className="text-left">
										<p className="text-sm text-muted-foreground">
											No clients added yet
										</p>
										<Button
											type="button"
											variant="link"
											size="sm"
											className="h-auto p-0"
											onClick={handleAddParticipant}
										>
											Add first client
										</Button>
									</div>
								</div>
							) : (
								<div className="overflow-hidden rounded-lg border bg-muted/10">
									<div className="grid grid-cols-[1.35fr_1fr_2.25rem] gap-2 border-b px-3 py-2 text-sm font-medium text-muted-foreground">
										<div>Client</div>
										<div>Role</div>
										<div aria-hidden />
									</div>
									{participants.map((field, index) => (
										<div
											key={field.id}
											className={`grid grid-cols-[1.35fr_1fr_2.25rem] items-start gap-2 px-3 py-3 ${index === 0 ? "" : "border-t"}`}
										>
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
															htmlFor={field.name}
															className="sr-only"
														>
															Client
														</FieldLabel>
														<Combobox
															id={field.name}
															options={clients.map(
																(client) => {
																	const isAlreadySelected =
																		selectedClientIds.has(
																			client.id,
																		) &&
																		field.value !==
																			client.id;
																	return {
																		value: client.id,
																		label: isAlreadySelected
																			? `${client.name} (already added)`
																			: client.name,
																		description:
																			client.phoneNumber ??
																			undefined,
																		disabled:
																			isAlreadySelected,
																	};
																},
															)}
															value={field.value}
															onValueChange={
																field.onChange
															}
															placeholder="Select client..."
															searchPlaceholder="Search clients..."
															emptyText="No clients found."
															aria-invalid={
																fieldState.invalid
															}
															onCreate={{
																label: "Add new client",
																onClick: () =>
																	handleCreateNewClient(
																		index,
																	),
															}}
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
															htmlFor={field.name}
															className="sr-only"
														>
															Role
														</FieldLabel>
														<Combobox
															id={field.name}
															options={(() => {
																const options: Array<{
																	value: string;
																	label: string;
																	disabled?: boolean;
																}> =
																	filteredRoleOptions.map(
																		(
																			type,
																		) => ({
																			value: type.key,
																			label: type.label,
																		}),
																	);

																if (
																	field.value &&
																	!filteredRoleOptions.find(
																		(r) =>
																			r.key ===
																			field.value,
																	)
																) {
																	const roleConfig =
																		relationTypes.find(
																			(
																				r,
																			) =>
																				r.key ===
																				field.value,
																		);
																	if (
																		roleConfig
																	) {
																		options.unshift(
																			{
																				value: roleConfig.key,
																				label: `${roleConfig.label} (not applicable)`,
																				disabled: true,
																			},
																		);
																	}
																}
																return options;
															})()}
															value={field.value}
															onValueChange={
																field.onChange
															}
															placeholder="Select role..."
															searchPlaceholder="Search roles..."
															emptyText="No roles found."
															aria-invalid={
																fieldState.invalid
															}
															onCreate={{
																label: "Add Role...",
																onClick: () =>
																	openCreateConfiguration(
																		"relation_type",
																	),
															}}
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

											<Button
												type="button"
												variant="ghost"
												size="icon"
												className="min-h-9 min-w-9 self-center text-destructive hover:text-destructive hover:bg-destructive/10"
												onClick={() =>
													removeParticipant(index)
												}
												disabled={
													participants.length <= 1
												}
											>
												<TrashIcon className="h-4 w-4" />
												<span className="sr-only">
													Remove client
												</span>
											</Button>
										</div>
									))}
									<div className=" pl-4 pr-13 pb-2 pt-1">
										<Button
											type="button"
											variant="outline"
											size="sm"
											className="w-full justify-center border-dashed"
											onClick={handleAddParticipant}
										>
											<PlusIcon className="mr-2 h-4 w-4" />
											Add another client to the booking
										</Button>
									</div>
								</div>
							)}
						</FieldSet>

						<FieldSeparator />

						{/* Section 3: Booking Name */}
						<Controller
							name="name"
							control={form.control}
							render={({ field, fieldState }) => (
								<Field
									orientation="responsive"
									data-invalid={fieldState.invalid}
								>
									<div className="flex-1">
										<FieldContent>
											<FieldLabel htmlFor={field.name}>
												Booking Name
											</FieldLabel>

											<FieldDescription>
												Auto-generated from clients
												(editable)
											</FieldDescription>
										</FieldContent>
									</div>
									<div className="w-full md:min-w-[320px]  md:shrink-0">
										<Input
											{...field}
											id={field.name}
											placeholder="Booking name..."
											aria-invalid={fieldState.invalid}
											onChange={(e) => {
												const nextValue =
													e.target.value;
												setIsNameManuallyEdited(
													Boolean(nextValue.trim()),
												);
												field.onChange(nextValue);
											}}
										/>
										{fieldState.invalid && (
											<FieldError
												errors={[fieldState.error]}
											/>
										)}
									</div>
								</Field>
							)}
						/>
						<FieldGroup className="gap-3">
							{/* Row 1: Package + Cost */}
							<div className="grid gap-3 md:grid-cols-[1.35fr_1fr]">
								{/* Package Type */}
								<Controller
									name="packageType"
									control={form.control}
									render={({ field, fieldState }) => (
										<Field
											data-invalid={fieldState.invalid}
										>
											<FieldLabel htmlFor={field.name}>
												Package
											</FieldLabel>
											<Combobox
												id={field.name}
												options={filteredPackageTypes.map(
													(pkg) => ({
														value: pkg.key,
														label: pkg.label,
													}),
												)}
												value={field.value}
												onValueChange={
													handlePackageChange
												}
												placeholder="Select package..."
												searchPlaceholder="Search packages..."
												emptyText="No packages found."
												disabled={!selectedBookingType}
												aria-invalid={
													fieldState.invalid
												}
												onCreate={{
													label: "Add Package...",
													onClick: () =>
														openCreateConfiguration(
															"package_type",
														),
												}}
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
										<Field
											data-invalid={fieldState.invalid}
										>
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
													disabled={
														!selectedBookingType
													}
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
												aria-invalid={
													fieldState.invalid
												}
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
															handleFileUpload(
																file,
															);
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
					</FieldGroup>
				</FieldSet>
			</CardContent>
		</Card>
	);
}
