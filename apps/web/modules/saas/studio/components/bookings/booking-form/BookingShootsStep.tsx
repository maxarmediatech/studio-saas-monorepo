"use client";

import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Combobox, type ComboboxOption } from "@repo/ui/components/combobox";
import { DatePicker } from "@repo/ui/components/date-picker";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from "@repo/ui/components/input-group";
import { Textarea } from "@repo/ui/components/textarea";
import { TimePicker } from "@repo/ui/components/time-picker";
import { useConfigurationParams } from "@saas/studio/hooks/params/use-configuration-params";
import { useQuery } from "@tanstack/react-query";
import {
	CameraIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	PlusIcon,
	TrashIcon,
	UsersIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import { toast } from "sonner";
import { bookingFormQueries } from "./booking-form-queries";
import type { BookingFormValues } from "./booking-form-schema";

export function BookingShootsStep() {
	const form = useFormContext<BookingFormValues>();

	// Fetch crews and event types using centralized query options
	const { data: crewsData } = useQuery(bookingFormQueries.crews());
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

	// Use real data from API
	const crews = crewsData?.data ?? [];

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
				location: "",
				notes: "",
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
					{/* Row 1: Event Type + Date + Start Time (2:1:1 ratio) */}
					<div className="grid gap-3 grid-cols-1 md:grid-cols-4">
						{/* Event Type - spans 2 columns on md+ */}
						<div className="md:col-span-2">
							<Controller
								name={`shoots.${shootIndex}.shootType`}
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={field.name}>
											Event Type
										</FieldLabel>
										{hasConfiguredEventTypes ? (
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
												aria-invalid={
													fieldState.invalid
												}
												onCreate={{
													label: "Add event type",
													onClick: () =>
														openCreate(
															"event_type",
														),
												}}
											/>
										) : (
											<Input
												id={field.name}
												value={field.value ?? ""}
												onChange={(e) =>
													field.onChange(
														e.target.value,
													)
												}
												placeholder="e.g. Wedding, Haldi, Reception..."
												aria-invalid={
													fieldState.invalid
												}
											/>
										)}
										{fieldState.invalid && (
											<FieldError
												errors={[fieldState.error]}
											/>
										)}
									</Field>
								)}
							/>
						</div>

						{/* Date - 1 column */}
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

						{/* Start Time - 1 column */}
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

				{/* Crew Assignments - Table layout matching Clients pattern */}
				<Field>
					<FieldLabel>Crew Assignments</FieldLabel>
					{crewAssignmentFields.length === 0 ? (
						<div className="flex items-center gap-3 py-6 px-4 border border-dashed rounded-lg">
							<UsersIcon className="h-8 w-8 text-muted-foreground/50 shrink-0" />
							<div className="text-left">
								<p className="text-sm text-muted-foreground">
									No crew assigned yet
								</p>
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
						<div className="overflow-hidden rounded-lg border bg-muted/10">
							{/* Column Headers */}
							<div className="grid grid-cols-[2fr_1fr_2.25rem] gap-2 border-b px-3 py-2 text-sm font-medium text-muted-foreground">
								<div>Crew</div>
								<div>Rate</div>
								<div aria-hidden />
							</div>

							{/* Data Rows */}
							{crewAssignmentFields.map(
								(assignmentField, assignmentIndex) => (
									<div
										key={assignmentField.id}
										className={`grid grid-cols-[2fr_1fr_2.25rem] items-start gap-2 px-3 py-3 ${assignmentIndex > 0 ? "border-t" : ""}`}
									>
										{/* Crew Combobox */}
										<Controller
											name={`shoots.${shootIndex}.crewAssignments.${assignmentIndex}.crewId`}
											control={form.control}
											render={({ field, fieldState }) => (
												<Combobox
													value={field.value ?? ""}
													onValueChange={(value) =>
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
												/>
											)}
										/>

										{/* Rate Input */}
										<Controller
											name={`shoots.${shootIndex}.crewAssignments.${assignmentIndex}.rate`}
											control={form.control}
											render={({ field, fieldState }) => (
												<InputGroup>
													<InputGroupAddon>
														<InputGroupText>
															₹
														</InputGroupText>
													</InputGroupAddon>
													<InputGroupInput
														type="number"
														step="0.01"
														value={
															field.value ?? ""
														}
														onChange={(e) =>
															field.onChange(
																e.target.value,
															)
														}
														placeholder="Rate"
														aria-invalid={
															fieldState.invalid
														}
													/>
												</InputGroup>
											)}
										/>

										{/* Remove Button */}
										<Button
											type="button"
											variant="ghost"
											size="icon"
											className="min-h-9 min-w-9 self-center text-destructive hover:text-destructive hover:bg-destructive/10"
											onClick={() =>
												removeCrewAssignment(
													assignmentIndex,
												)
											}
										>
											<TrashIcon className="h-4 w-4" />
											<span className="sr-only">
												Remove crew
											</span>
										</Button>
									</div>
								),
							)}

							{/* Add Button Footer */}
							<div className="px-3 pb-2 pt-1">
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="w-full justify-center border-dashed"
									onClick={addCrewAssignment}
								>
									<PlusIcon className="mr-2 h-4 w-4" />
									Add another crew member
								</Button>
							</div>
						</div>
					)}
				</Field>
			</div>
		</div>
	);
}
