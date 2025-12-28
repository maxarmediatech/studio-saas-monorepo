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
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldSet,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Textarea } from "@repo/ui/components/textarea";
import { useQuery } from "@tanstack/react-query";
import { ClipboardListIcon, PlusIcon, TrashIcon, UserPlusIcon, UsersIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import type { BookingFormValues } from "./booking-form-schema";
import { bookingFormQueries } from "./booking-form-queries";
import { CreateClientDialog } from "./create-client-dialog";

export function BookingDetailsStep() {
	const form = useFormContext<BookingFormValues>();
	const [
		createClientForParticipantIndex,
		setCreateClientForParticipantIndex,
	] = useState<number | null>(null);

	// Fetch configurations using centralized query options
	const { data: bookingTypesData } = useQuery(bookingFormQueries.bookingTypes());
	const { data: packageTypesData } = useQuery(bookingFormQueries.packageTypes());
	const { data: relationTypesData } = useQuery(bookingFormQueries.relationTypes());
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
						Booking Information
					</CardTitle>
				</CardHeader>
				<CardContent>
					<FieldGroup>
						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
						{/* Booking Name */}
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
											aria-invalid={fieldState.invalid}
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
											aria-invalid={fieldState.invalid}
										>
											<SelectValue placeholder="Select package" />
										</SelectTrigger>
										<SelectContent>
											{filteredPackageTypes.length > 0 ? (
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
											aria-invalid={fieldState.invalid}
											onChange={(e) => {
												// Allow only numbers and decimal point
												const value =
													e.target.value.replace(
														/[^0-9.]/g,
														"",
													);
												// Prevent multiple decimal points
												const parts = value.split(".");
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

						{/* Notes */}
						<div className="md:col-span-2 lg:col-span-4">
							<Controller
								name="note"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={field.name}>
											Notes
										</FieldLabel>
										<Textarea
											{...field}
											id={field.name}
											placeholder="Add any booking specific notes or requests"
											rows={2}
											aria-invalid={fieldState.invalid}
										/>
										<FieldDescription>
											Any special requirements or notes
											for this booking
										</FieldDescription>
										{fieldState.invalid && (
											<FieldError
												errors={[fieldState.error]}
											/>
										)}
									</Field>
								)}
							/>
						</div>
						</div>
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
									No participants added yet. Click "Add Participant"
									to add clients to this booking.
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
															htmlFor={field.name}
														>
															Client
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
															htmlFor={field.name}
														>
															Role
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
																<SelectValue placeholder="Select role" />
															</SelectTrigger>
															<SelectContent>
																{relationTypes.map(
																	(type) => (
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
												disabled={participants.length <= 1}
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
