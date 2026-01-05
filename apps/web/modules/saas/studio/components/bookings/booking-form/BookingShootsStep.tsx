"use client";

import {
	AutocompleteInput,
	type AutocompleteSuggestion,
} from "@repo/ui/components/autocomplete-input";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
	FieldTitle,
} from "@repo/ui/components/field";
import { DatePicker } from "@repo/ui/components/date-picker";
import { TimePicker } from "@repo/ui/components/time-picker";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Textarea } from "@repo/ui/components/textarea";
import { useQuery } from "@tanstack/react-query";
import {
	CameraIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	MapPinIcon,
	PlusIcon,
	TrashIcon,
	UserPlusIcon,
	UsersIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import { bookingFormQueries } from "./booking-form-queries";
import {
	type BookingFormValues,
	SHOOT_TYPE_OPTIONS,
} from "./booking-form-schema";

export function BookingShootsStep() {
	const form = useFormContext<BookingFormValues>();

	// Fetch crews and roles using centralized query options
	const { data: crewsData } = useQuery(bookingFormQueries.crews());
	const { data: crewRolesData } = useQuery(bookingFormQueries.crewRoles());
	const { data: bookingTypesData } = useQuery(
		bookingFormQueries.bookingTypes(),
	);

	// Watch booking type to filter shoot type suggestions
	const selectedBookingType = form.watch("bookingType");

	// Compute shoot type suggestions based on booking type metadata
	const shootTypeSuggestions = useMemo((): AutocompleteSuggestion[] => {
		const bookingTypeConfig = bookingTypesData?.data?.find(
			(bt) => bt.key === selectedBookingType,
		);
		const configuredSuggestions = (
			bookingTypeConfig?.metadata as {
				suggestedShootTypes?: string[];
			} | null
		)?.suggestedShootTypes;

		// If booking type has configured suggestions, use those
		if (configuredSuggestions?.length) {
			return configuredSuggestions.map((st) => ({
				value: st,
				label: st,
			}));
		}

		// Fallback to static SHOOT_TYPE_OPTIONS
		return SHOOT_TYPE_OPTIONS.map((opt) => ({
			value: opt.label, // Use label as value for free-text display
			label: opt.label,
		}));
	}, [selectedBookingType, bookingTypesData]);

	// Use real data from API
	const crews = crewsData?.data ?? [];
	const crewRoles = useMemo(() => {
		// Use configured crew roles, or derive from crew data if not configured
		if (crewRolesData?.data?.length) {
			return crewRolesData.data.map((r) => ({
				id: r.id,
				key: r.key,
				label: r.label,
			}));
		}

		// Fallback: derive roles from existing crew members
		const derivedRoles = new Map<
			string,
			{ id: string; key: string; label: string }
		>();

		for (const crew of crews) {
			const label = crew.role?.trim();
			if (!label) {
				continue;
			}

			const key = label.toLowerCase().replaceAll(/\s+/g, "_");
			derivedRoles.set(key, { id: key, key, label });
		}

		return Array.from(derivedRoles.values());
	}, [crews, crewRolesData]);

	const {
		fields: shoots,
		append: appendShoot,
		remove: removeShoot,
	} = useFieldArray({
		control: form.control,
		name: "shoots",
	});

	const addNewShoot = () => {
		appendShoot({
			shootType: "",
			shootDate: "",
			startTime: "",
			location: "",
			notes: "",
			crewAssignments: [],
		});
	};

	return (
		<Card className="shadow-none">
			<CardContent>
				<FieldSet>
					<FieldLegend>Shoots</FieldLegend>
					<FieldDescription>
						Schedule photo/video shoots for this booking
					</FieldDescription>
					{/* <FieldSeparator /> */}
					<FieldGroup>
						{/* Section header with Add button */}
						{/* <Field orientation="responsive">
							<div className="flex-1">
								<FieldContent>
									<FieldTitle className="flex items-center gap-2">
										<CameraIcon className="h-4 w-4" />
										Shoot Sessions
									</FieldTitle>
									<FieldDescription>
										Add and configure photo/video sessions
									</FieldDescription>
								</FieldContent>
							</div>
							<Button
								type="button"
								variant="secondary"
								size="sm"
								onClick={addNewShoot}
							>
								<PlusIcon className="mr-1.5 h-3.5 w-3.5" />
								Add shoot
							</Button>
						</Field> */}

						{/* Shoots list */}
						{shoots.length === 0 ? (
							<div className="flex items-center gap-3 py-6 px-4 border border-dashed rounded-lg">
								<CameraIcon className="h-8 w-8 text-muted-foreground/50 shrink-0" />
								<div className="text-left">
									<p className="text-sm text-muted-foreground">
										No shoots scheduled yet
									</p>
									<Button
										type="button"
										variant="link"
										size="sm"
										className="h-auto p-0"
										onClick={addNewShoot}
									>
										Add first shoot
									</Button>
								</div>
							</div>
						) : (
							<FieldGroup className="gap-4">
								{shoots.map((shoot, shootIndex) => (
									<ShootSection
										key={shoot.id}
										shootIndex={shootIndex}
										crews={crews}
										crewRoles={crewRoles}
										shootTypeSuggestions={
											shootTypeSuggestions
										}
										onRemove={() => removeShoot(shootIndex)}
										canRemove={shoots.length > 0}
									/>
								))}

								{/* Add another shoot button */}
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="w-full justify-center border-dashed"
									onClick={addNewShoot}
								>
									<PlusIcon className="mr-2 h-4 w-4" />
									Add another shoot
								</Button>
							</FieldGroup>
						)}
					</FieldGroup>
				</FieldSet>
			</CardContent>
		</Card>
	);
}

interface ShootSectionProps {
	shootIndex: number;
	crews: Array<{
		id: string;
		name: string;
		role: string;
		phoneNumber?: string | null;
	}>;
	crewRoles: Array<{ id: string; key: string; label: string }>;
	shootTypeSuggestions: AutocompleteSuggestion[];
	onRemove: () => void;
	canRemove: boolean;
}

function ShootSection({
	shootIndex,
	crews,
	crewRoles,
	shootTypeSuggestions,
	onRemove,
	canRemove,
}: ShootSectionProps) {
	const form = useFormContext<BookingFormValues>();
	const [showNotes, setShowNotes] = useState(false);

	const {
		fields: crewAssignments,
		append: appendCrewAssignment,
		remove: removeCrewAssignment,
	} = useFieldArray({
		control: form.control,
		name: `shoots.${shootIndex}.crewAssignments`,
	});

	// Check if notes has content to auto-expand
	const notesValue = form.watch(`shoots.${shootIndex}.notes`);

	return (
		<div className="overflow-hidden rounded-lg border bg-muted/10">
			{/* Header row */}
			<div className="flex items-center justify-between gap-2 border-b bg-muted/20 px-4 py-3">
				<div className="flex items-center gap-2">
					<CameraIcon className="h-4 w-4 text-muted-foreground" />
					<span className="text-sm font-medium">
						Shoot {shootIndex + 1}
					</span>
				</div>
				{canRemove && (
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
						onClick={onRemove}
					>
						<TrashIcon className="h-4 w-4" />
						<span className="sr-only">Remove shoot</span>
					</Button>
				)}
			</div>

			{/* Content */}
			<div className="p-4 space-y-4">
				{/* Basic Info */}
				<FieldGroup className="gap-3">
					{/* Row 1: Shoot Type (full width, autocomplete) */}
					<Controller
						name={`shoots.${shootIndex}.shootType`}
						control={form.control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid}>
								<FieldLabel htmlFor={field.name}>
									Event Type
								</FieldLabel>
								<AutocompleteInput
									id={field.name}
									value={field.value ?? ""}
									onChange={field.onChange}
									suggestions={shootTypeSuggestions}
									placeholder="e.g. Wedding, Haldi, Reception..."
									aria-invalid={fieldState.invalid}
								/>
								{fieldState.invalid && (
									<FieldError errors={[fieldState.error]} />
								)}
							</Field>
						)}
					/>

					{/* Row 2: Date + Start Time (2 columns) */}
					<div className="grid gap-3 md:grid-cols-2">
						{/* Shoot Date */}
						<Controller
							name={`shoots.${shootIndex}.shootDate`}
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
										<FieldError
											errors={[fieldState.error]}
										/>
									)}
								</Field>
							)}
						/>

						{/* Start Time */}
						<Controller
							name={`shoots.${shootIndex}.startTime`}
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor={field.name}>
										Start Time
									</FieldLabel>
									<TimePicker
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
					</div>

					{/* Row 3: Location (single textarea) */}
					<Controller
						name={`shoots.${shootIndex}.location`}
						control={form.control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid}>
								<FieldLabel htmlFor={field.name}>
									<MapPinIcon className="h-3.5 w-3.5 inline mr-1" />
									Location
								</FieldLabel>
								<Textarea
									{...field}
									id={field.name}
									placeholder="e.g. Grand Ballroom, Hotel Taj, 123 Main Street, Mumbai"
									rows={2}
									maxLength={500}
									aria-invalid={fieldState.invalid}
								/>
								{fieldState.invalid && (
									<FieldError errors={[fieldState.error]} />
								)}
							</Field>
						)}
					/>

					{/* Row 4: Collapsible Notes */}
					{(showNotes || notesValue) && (
						<Controller
							name={`shoots.${shootIndex}.notes`}
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<div className="flex items-center justify-between">
										<FieldLabel htmlFor={field.name}>
											Notes
										</FieldLabel>
										{/* Hide button - only when expanded manually and empty */}
										{showNotes && !notesValue && (
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="h-auto py-0 px-1 text-muted-foreground"
												onClick={() =>
													setShowNotes(false)
												}
											>
												<ChevronUpIcon className="mr-1 h-3.5 w-3.5" />
												Hide
											</Button>
										)}
									</div>
									<Textarea
										{...field}
										id={field.name}
										placeholder="Any special instructions for this shoot"
										rows={2}
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
					)}

					{/* Add Notes button (when notes hidden) */}
					{!showNotes && !notesValue && (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="w-fit text-muted-foreground"
							onClick={() => setShowNotes(true)}
						>
							<ChevronDownIcon className="mr-1.5 h-3.5 w-3.5" />
							Add notes
						</Button>
					)}
				</FieldGroup>

				{/* Crew Assignments */}
				<FieldSet>
					{/* Section header */}
					<Field orientation="responsive">
						<div className="flex-1">
							<FieldContent>
								<FieldTitle className="flex items-center gap-2">
									<UsersIcon className="h-4 w-4" />
									Crew
									{crewAssignments.length > 0 && (
										<Badge variant="secondary">
											{crewAssignments.length}
										</Badge>
									)}
								</FieldTitle>
								<FieldDescription>
									Assign team members to this shoot
								</FieldDescription>
							</FieldContent>
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() =>
								appendCrewAssignment({
									crewId: "",
									role: "",
									isLead: false,
								})
							}
						>
							<PlusIcon className="mr-1.5 h-3.5 w-3.5" />
							Assign crew
						</Button>
					</Field>

					{crewAssignments.length === 0 ? (
						<div className="flex items-center gap-3 py-4 px-4 border border-dashed rounded-lg">
							<UserPlusIcon className="h-6 w-6 text-muted-foreground/50 shrink-0" />
							<div className="text-left">
								<p className="text-sm text-muted-foreground">
									No crew assigned
								</p>
								<Button
									type="button"
									variant="link"
									size="sm"
									className="h-auto p-0"
									onClick={() =>
										appendCrewAssignment({
											crewId: "",
											role: "",
											isLead: false,
										})
									}
								>
									Assign first crew member
								</Button>
							</div>
						</div>
					) : (
						<div className="overflow-hidden rounded-lg border bg-muted/10">
							{/* Header row */}
							<div className="grid grid-cols-[1fr_1fr_4.5rem_2.25rem] gap-2 border-b px-3 py-2 text-sm font-medium text-muted-foreground">
								<div>Crew Member</div>
								<div>Role</div>
								<div>Lead</div>
								<div aria-hidden />
							</div>

							{/* Data rows */}
							{crewAssignments.map(
								(assignment, assignmentIndex) => (
									<div
										key={assignment.id}
										className={`grid grid-cols-[1fr_1fr_4.5rem_2.25rem] items-start gap-2 px-3 py-3 ${assignmentIndex > 0 ? "border-t" : ""}`}
									>
										{/* Crew Member */}
										<Controller
											name={`shoots.${shootIndex}.crewAssignments.${assignmentIndex}.crewId`}
											control={form.control}
											render={({ field, fieldState }) => (
												<Field
													data-invalid={
														fieldState.invalid
													}
												>
													<FieldLabel
														htmlFor={field.name}
														className="sr-only"
													>
														Crew Member
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
															<SelectValue placeholder="Select crew" />
														</SelectTrigger>
														<SelectContent>
															{crews.length >
															0 ? (
																crews.map(
																	(crew) => (
																		<SelectItem
																			key={
																				crew.id
																			}
																			value={
																				crew.id
																			}
																		>
																			<div className="flex flex-col">
																				<span>
																					{
																						crew.name
																					}
																				</span>
																				<span className="text-xs text-muted-foreground">
																					{
																						crew.role
																					}
																				</span>
																			</div>
																		</SelectItem>
																	),
																)
															) : (
																<div className="p-2 text-sm text-muted-foreground text-center">
																	No crew
																	members
																	found
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

										{/* Role */}
										<Controller
											name={`shoots.${shootIndex}.crewAssignments.${assignmentIndex}.role`}
											control={form.control}
											render={({ field, fieldState }) => (
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
															{crewRoles.length >
															0 ? (
																crewRoles.map(
																	(role) => (
																		<SelectItem
																			key={
																				role.id
																			}
																			value={
																				role.key
																			}
																		>
																			{
																				role.label
																			}
																		</SelectItem>
																	),
																)
															) : (
																<>
																	<SelectItem value="lead_photographer">
																		Lead
																		Photographer
																	</SelectItem>
																	<SelectItem value="photographer">
																		Photographer
																	</SelectItem>
																	<SelectItem value="lead_videographer">
																		Lead
																		Videographer
																	</SelectItem>
																	<SelectItem value="videographer">
																		Videographer
																	</SelectItem>
																	<SelectItem value="drone_operator">
																		Drone
																		Operator
																	</SelectItem>
																	<SelectItem value="assistant">
																		Assistant
																	</SelectItem>
																</>
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

										{/* Is Lead Toggle */}
										<Controller
											name={`shoots.${shootIndex}.crewAssignments.${assignmentIndex}.isLead`}
											control={form.control}
											render={({ field }) => (
												<Button
													type="button"
													variant={
														field.value
															? "default"
															: "outline"
													}
													size="sm"
													onClick={() =>
														field.onChange(
															!field.value,
														)
													}
													className="h-9 w-full"
												>
													{field.value
														? "Lead"
														: "Set"}
												</Button>
											)}
										/>

										{/* Remove */}
										<Button
											type="button"
											variant="ghost"
											size="icon"
											className="h-9 w-9 self-center text-destructive hover:text-destructive hover:bg-destructive/10"
											onClick={() =>
												removeCrewAssignment(
													assignmentIndex,
												)
											}
										>
											<TrashIcon className="h-4 w-4" />
											<span className="sr-only">
												Remove crew assignment
											</span>
										</Button>
									</div>
								),
							)}

							{/* Add another row */}
							<div className="px-3 pb-2 pt-1">
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="w-full justify-center border-dashed"
									onClick={() =>
										appendCrewAssignment({
											crewId: "",
											role: "",
											isLead: false,
										})
									}
								>
									<PlusIcon className="mr-2 h-4 w-4" />
									Add another crew member
								</Button>
							</div>
						</div>
					)}
				</FieldSet>
			</div>
		</div>
	);
}
