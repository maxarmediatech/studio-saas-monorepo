"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Combobox, type ComboboxOption } from "@repo/ui/components/combobox";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@repo/ui/components/field";
import { CustomField, DateField } from "@repo/ui/components/form-fields";
import { FieldRow } from "@repo/ui/components/form-section";
import { Input } from "@repo/ui/components/input";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from "@repo/ui/components/input-group";
import {
	AddItemButton,
	ItemCard,
	ItemCardHeader,
} from "@repo/ui/components/item-list";
import { MultiSelectCombobox } from "@repo/ui/components/multi-select-combobox";
import { Textarea } from "@repo/ui/components/textarea";
import { TimePicker } from "@repo/ui/components/time-picker";
import { useAllCrewOptions } from "@saas/studio/components/shared";
import { useConfigurationParams } from "@saas/studio/hooks/params/use-configuration-params";
import {
	getShootExtraServiceLabel,
	SHOOT_EXTRA_SERVICE_OPTIONS,
} from "@saas/studio/lib/shoot-planning";
import { useQuery } from "@tanstack/react-query";
import {
	CameraIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	PlusIcon,
	UsersIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import { toast } from "sonner";
import { bookingFormQueries } from "./booking-form-queries";
import type { BookingFormValues } from "./booking-form-schema";

export function BookingShootsStep() {
	const form = useFormContext<BookingFormValues>();

	const { data: crews = [] } = useAllCrewOptions();
	const { data: eventTypesData, isPending: eventTypesLoading } = useQuery(
		bookingFormQueries.eventTypes(),
	);

	// Watch booking type to filter event types
	const selectedBookingType = form.watch("bookingType");

	// Watch all shoots to track selected event types across shoots
	const allShoots = form.watch("shoots");

	// Compute filtered event types based on booking type
	const filteredEventTypes = useMemo((): ComboboxOption[] => {
		const allEventTypes = eventTypesData?.data ?? [];

		// Filter event types that apply to the selected booking type
		const applicable = allEventTypes.filter((et) => {
			const metadata = et.metadata as { bookingTypes?: string[] } | null;
			// If no booking types specified, available for all
			if (!metadata?.bookingTypes?.length) {
				return true;
			}
			// Otherwise, must include selected booking type
			return metadata.bookingTypes.includes(selectedBookingType);
		});

		return applicable.map((et) => ({
			value: et.key, // Store key (consistent with other configs like booking_type)
			label: et.label,
		}));
	}, [eventTypesData, selectedBookingType]);

	// Determine if we should use Combobox or free-text input
	// Show combobox while loading OR when we have configured event types
	// Only fall back to free-text input when loaded AND no event types exist
	const hasConfiguredEventTypes =
		eventTypesLoading || filteredEventTypes.length > 0;

	// Get available event types for a specific shoot, excluding types already selected in other shoots
	const getAvailableEventTypes = (shootIndex: number): ComboboxOption[] => {
		if (!allShoots) {
			return filteredEventTypes;
		}

		const currentValue = allShoots[shootIndex]?.shootType;
		const selectedByOtherShoots = allShoots
			.filter((_, idx) => idx !== shootIndex)
			.map((s) => s.shootType)
			.filter(Boolean);

		return filteredEventTypes.filter((et) => {
			// Always keep the current shoot's selection visible
			if (et.value === currentValue) {
				return true;
			}
			// Exclude types already selected in other shoots
			return !selectedByOtherShoots.includes(et.value);
		});
	};

	const {
		fields: shoots,
		append: appendShoot,
		remove: removeShoot,
	} = useFieldArray({
		control: form.control,
		name: "shoots",
	});

	const addNewShoot = () => {
		const currentShoots = form.getValues("shoots") ?? [];
		const incompleteIndex = currentShoots.findIndex(
			(shoot) => !shoot?.shootType?.trim() || !shoot?.shootDate?.trim(),
		);

		if (incompleteIndex !== -1) {
			const missingField = !currentShoots[
				incompleteIndex
			]?.shootType?.trim()
				? "shootType"
				: "shootDate";

			toast.warning(
				"Please complete the current shoot before adding another.",
			);
			form.setFocus(`shoots.${incompleteIndex}.${missingField}` as never);
			return;
		}

		const newIndex = shoots.length; // Index of the new shoot
		appendShoot(
			{
				shootType: "",
				shootDate: "",
				startTime: "",
				requiredCrewCount: "",
				location: "",
				notes: "",
				additionalServices: [],
				crewAssignments: [],
			},
			{ shouldFocus: false },
		);
		// Focus the event type field after React renders the new shoot
		setTimeout(() => {
			const eventTypeField = document.getElementById(
				`shoots.${newIndex}.shootType`,
			);
			eventTypeField?.focus();
		}, 0);
	};

	return (
		<div className="space-y-4">
			<FieldSet className="gap-1">
				<FieldLegend className="mb-0">Shoots</FieldLegend>
			</FieldSet>
			<Card>
				<CardContent>
					<FieldSet>
						<FieldGroup>
							{/* Shoots list */}
							{shoots.length === 0 ? (
								<div className="flex flex-col items-center justify-center gap-3 py-8 px-4 border border-dashed rounded-lg">
									<CameraIcon className="h-10 w-10 text-muted-foreground/30" />
									<p className="text-sm text-muted-foreground text-center">
										No shoots scheduled yet
									</p>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={addNewShoot}
									>
										<PlusIcon className="mr-2 h-4 w-4" />
										Add first shoot
									</Button>
								</div>
							) : (
								<FieldGroup className="gap-4">
									{shoots.map((shoot, shootIndex) => (
										<ShootSection
											key={shoot.id}
											shootIndex={shootIndex}
											crews={crews}
											eventTypeOptions={getAvailableEventTypes(
												shootIndex,
											)}
											hasConfiguredEventTypes={
												hasConfiguredEventTypes
											}
											eventTypesLoading={
												eventTypesLoading
											}
											onRemove={() =>
												removeShoot(shootIndex)
											}
											canRemove={shoots.length > 0}
										/>
									))}

									{/* Add another shoot button */}
									<AddItemButton onClick={addNewShoot}>
										Add another shoot
									</AddItemButton>
								</FieldGroup>
							)}
						</FieldGroup>
					</FieldSet>
				</CardContent>
			</Card>
		</div>
	);
}

interface ShootSectionProps {
	shootIndex: number;
	crews: Array<{
		id: string;
		name: string;
		phoneNumber?: string | null;
		dailyRate?: string | null;
		userId?: string | null;
	}>;
	eventTypeOptions: ComboboxOption[];
	hasConfiguredEventTypes: boolean;
	eventTypesLoading: boolean;
	onRemove: () => void;
	canRemove: boolean;
}

function ShootSection({
	shootIndex,
	crews,
	eventTypeOptions,
	hasConfiguredEventTypes,
	eventTypesLoading,
	onRemove,
	canRemove,
}: ShootSectionProps) {
	const form = useFormContext<BookingFormValues>();
	const [showNotes, setShowNotes] = useState(false);
	const { openCreate } = useConfigurationParams();

	// Check if notes has content to auto-expand
	const notesValue = form.watch(`shoots.${shootIndex}.notes`);
	const requiredCrewCountValue = form.watch(
		`shoots.${shootIndex}.requiredCrewCount`,
	);
	const additionalServicesValue =
		form.watch(`shoots.${shootIndex}.additionalServices`) ?? [];

	// useFieldArray for crew assignments
	const {
		fields: crewAssignmentFields,
		append: appendCrewAssignment,
		remove: removeCrewAssignment,
	} = useFieldArray({
		control: form.control,
		name: `shoots.${shootIndex}.crewAssignments`,
	});

	// Watch current crew assignments to filter available crews
	const currentAssignments =
		form.watch(`shoots.${shootIndex}.crewAssignments`) ?? [];
	const selectedCrewIds = currentAssignments.map((a) => a.crewId);

	// Create a map for quick crew lookup
	const crewMap = useMemo(
		() => new Map(crews.map((c) => [c.id, c])),
		[crews],
	);

	// Get available crews (not already assigned to this shoot)
	const getAvailableCrews = (currentCrewId?: string): ComboboxOption[] => {
		return crews
			.filter((crew) => {
				// Always include current selection
				if (crew.id === currentCrewId) {
					return true;
				}
				// Exclude already assigned crews
				return !selectedCrewIds.includes(crew.id);
			})
			.map((crew) => ({
				value: crew.id,
				label: crew.name,
			}));
	};

	// Handle crew selection - auto-populate rate from dailyRate
	const handleCrewSelect = (assignmentIndex: number, crewId: string) => {
		const crew = crewMap.get(crewId);
		form.setValue(
			`shoots.${shootIndex}.crewAssignments.${assignmentIndex}.crewId`,
			crewId,
		);
		// Auto-populate rate from crew's dailyRate
		if (crew?.dailyRate) {
			form.setValue(
				`shoots.${shootIndex}.crewAssignments.${assignmentIndex}.rate`,
				crew.dailyRate,
			);
		}
	};

	// Add new crew assignment row
	const addCrewAssignment = () => {
		appendCrewAssignment({ crewId: "", rate: "" });
	};

	return (
		<ItemCard className="gap-0 overflow-hidden p-0">
			{/* Header row */}
			<ItemCardHeader
				title={
					<span className="flex items-center gap-2">
						<CameraIcon className="h-4 w-4 text-muted-foreground" />
						Shoot {shootIndex + 1}
					</span>
				}
				onRemove={canRemove ? onRemove : undefined}
				removeLabel="Remove shoot"
				className="border-b bg-muted/20 px-4 py-3"
			/>

			{/* Content */}
			<div className="p-4 space-y-4">
				{/* Basic Info */}
				<FieldGroup className="gap-3">
					{/* Row 1: Event Type + Date + Start Time (2:1:1 ratio) */}
					<div className="grid gap-3 grid-cols-1 md:grid-cols-4">
						{/* Event Type - spans 2 columns on md+ */}
						<CustomField
							control={form.control}
							name={`shoots.${shootIndex}.shootType`}
							label="Event Type"
							className="md:col-span-2"
						>
							{({ field, fieldState }) =>
								hasConfiguredEventTypes ? (
									<Combobox
										id={field.name}
										value={field.value ?? ""}
										onValueChange={field.onChange}
										options={eventTypeOptions}
										placeholder={
											eventTypesLoading
												? "Loading..."
												: "Select event type..."
										}
										searchPlaceholder="Search events..."
										emptyText="No matching event types"
										disabled={eventTypesLoading}
										aria-invalid={fieldState.invalid}
										onCreate={{
											label: "Add event type",
											onClick: () =>
												openCreate("event_type"),
										}}
										className="h-8 px-2.5 text-13"
									/>
								) : (
									<Input
										id={field.name}
										value={field.value ?? ""}
										onChange={(e) =>
											field.onChange(e.target.value)
										}
										size="sm"
										placeholder="e.g. Wedding, Haldi, Reception..."
										aria-invalid={fieldState.invalid}
									/>
								)
							}
						</CustomField>

						{/* Date - 1 column */}
						<DateField
							control={form.control}
							name={`shoots.${shootIndex}.shootDate`}
							label="Date"
						/>

						{/* Start Time - 1 column */}
						<CustomField
							control={form.control}
							name={`shoots.${shootIndex}.startTime`}
							label="Start Time"
						>
							{({ field, fieldState }) => (
								<TimePicker
									value={field.value}
									onValueChange={field.onChange}
									id={field.name}
									aria-invalid={fieldState.invalid}
									className="h-8 px-2.5 text-13"
								/>
							)}
						</CustomField>
					</div>

					<FieldRow>
						<CustomField
							control={form.control}
							name={`shoots.${shootIndex}.requiredCrewCount`}
							label="Required Crew Count"
						>
							{({ field, fieldState }) => (
								<Input
									id={field.name}
									type="number"
									min="1"
									step="1"
									size="sm"
									value={field.value ?? ""}
									onChange={(e) =>
										field.onChange(e.target.value)
									}
									placeholder="e.g. 4"
									aria-invalid={fieldState.invalid}
								/>
							)}
						</CustomField>

						<CustomField
							control={form.control}
							name={`shoots.${shootIndex}.additionalServices`}
							label="Extra Services"
						>
							{({ field, fieldState }) => (
								<MultiSelectCombobox
									id={field.name}
									options={[...SHOOT_EXTRA_SERVICE_OPTIONS]}
									value={field.value ?? []}
									onValueChange={field.onChange}
									placeholder="Select extra services"
									searchPlaceholder="Search services..."
									emptyText="No extra services found"
									aria-invalid={fieldState.invalid}
									className="min-h-8 px-2.5 text-13"
								/>
							)}
						</CustomField>
					</FieldRow>

					{/* Row 3: Location (single textarea) */}
					<CustomField
						control={form.control}
						name={`shoots.${shootIndex}.location`}
						label="Location"
					>
						{({ field, fieldState }) => (
							<Textarea
								{...field}
								id={field.name}
								size="sm"
								placeholder="e.g. Grand Ballroom, Hotel Taj, 123 Main Street, Mumbai"
								rows={2}
								maxLength={500}
								aria-invalid={fieldState.invalid}
							/>
						)}
					</CustomField>

					{/* Row 4: Collapsible Notes */}
					{(showNotes || notesValue) && (
						<Controller
							name={`shoots.${shootIndex}.notes`}
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
										size="sm"
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
				<Field>
					<FieldLabel variant="micro">Crew Assignments</FieldLabel>
					{crewAssignmentFields.length === 0 ? (
						<div className="flex items-center gap-3 py-6 px-4 border border-dashed rounded-lg">
							<UsersIcon className="h-8 w-8 text-muted-foreground/50 shrink-0" />
							<div className="text-left">
								<p className="text-sm text-muted-foreground">
									No crew assigned yet
								</p>
								{requiredCrewCountValue && (
									<p className="text-xs text-muted-foreground">
										Assigned 0 / Required{" "}
										{requiredCrewCountValue}
									</p>
								)}
								<Button
									type="button"
									variant="link"
									size="sm"
									className="h-auto p-0"
									onClick={addCrewAssignment}
								>
									Add first crew member
								</Button>
							</div>
						</div>
					) : (
						<div className="grid gap-3">
							{crewAssignmentFields.map(
								(assignmentField, assignmentIndex) => (
									<ItemCard key={assignmentField.id}>
										<ItemCardHeader
											title={`Crew ${assignmentIndex + 1}`}
											onRemove={() =>
												removeCrewAssignment(
													assignmentIndex,
												)
											}
											removeLabel="Remove crew"
										/>
										<FieldRow>
											{/* Crew Combobox */}
											<CustomField
												control={form.control}
												name={`shoots.${shootIndex}.crewAssignments.${assignmentIndex}.crewId`}
												label="Crew"
											>
												{({ field, fieldState }) => (
													<Combobox
														id={field.name}
														value={
															field.value ?? ""
														}
														onValueChange={(
															value,
														) =>
															handleCrewSelect(
																assignmentIndex,
																value,
															)
														}
														options={getAvailableCrews(
															field.value,
														)}
														placeholder="Select crew..."
														searchPlaceholder="Search crew..."
														emptyText="No crew found"
														aria-invalid={
															fieldState.invalid
														}
														className="h-8 px-2.5 text-13"
													/>
												)}
											</CustomField>

											{/* Rate Input */}
											<CustomField
												control={form.control}
												name={`shoots.${shootIndex}.crewAssignments.${assignmentIndex}.rate`}
												label="Rate"
											>
												{({ field, fieldState }) => (
													<InputGroup>
														<InputGroupAddon>
															<InputGroupText>
																₹
															</InputGroupText>
														</InputGroupAddon>
														<InputGroupInput
															id={field.name}
															type="number"
															step="0.01"
															size="sm"
															value={
																field.value ??
																""
															}
															onChange={(e) =>
																field.onChange(
																	e.target
																		.value,
																)
															}
															placeholder="Rate"
															aria-invalid={
																fieldState.invalid
															}
														/>
													</InputGroup>
												)}
											</CustomField>
										</FieldRow>
									</ItemCard>
								),
							)}
						</div>
					)}

					{crewAssignmentFields.length > 0 && (
						<AddItemButton onClick={addCrewAssignment}>
							Add another crew member
						</AddItemButton>
					)}
				</Field>

				{(requiredCrewCountValue ||
					additionalServicesValue.length > 0) && (
					<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
						{requiredCrewCountValue && (
							<span>
								Assigned {currentAssignments.length} / Required{" "}
								{requiredCrewCountValue}
							</span>
						)}
						{additionalServicesValue.map((service) => (
							<Badge
								key={service}
								variant="outline"
								className="text-[11px]"
							>
								{getShootExtraServiceLabel(service)}
							</Badge>
						))}
					</div>
				)}
			</div>
		</ItemCard>
	);
}
