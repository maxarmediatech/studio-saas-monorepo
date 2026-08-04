"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@repo/ui/components/button";
import { Combobox, type ComboboxOption } from "@repo/ui/components/combobox";
import { DatePicker } from "@repo/ui/components/date-picker";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@repo/ui/components/field";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from "@repo/ui/components/input-group";
import { MultiSelectCombobox } from "@repo/ui/components/multi-select-combobox";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { Textarea } from "@repo/ui/components/textarea";
import { TimePicker } from "@repo/ui/components/time-picker";
import { useAllCrewOptions } from "@saas/studio/components/shared";
import { useStudioCapabilities } from "@saas/studio/components/studio-capabilities-context";
import { useConfigurationParams } from "@saas/studio/hooks/params/use-configuration-params";
import { bookingsApi, configurationsApi } from "@saas/studio/lib/api";
import {
	EVENT_SIDE_OPTIONS,
	type EventSide,
} from "@saas/studio/lib/event-side";
import {
	getShootExtraServiceLabel,
	SHOOT_EXTRA_SERVICE_OPTIONS,
} from "@saas/studio/lib/shoot-planning";
import { useQuery } from "@tanstack/react-query";
import {
	ChevronDownIcon,
	ChevronUpIcon,
	PlusIcon,
	TrashIcon,
	UsersIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { FormActions } from "../ui/FormActions";

// ============================================================================
// Schema
// ============================================================================

const crewAssignmentSchema = z.object({
	crewId: z.string().min(1, "Crew member is required"),
	rate: z.string().optional(),
});

const shootFormSchema = z.object({
	bookingId: z.string().min(1, "Booking is required"),
	bookingEventId: z.string().optional(),
	shootType: z.string().min(1, "Event type is required"),
	side: z.enum(["common", "bride", "groom", "both", "separateCommon"]),
	shootDate: z.string().min(1, "Date is required"),
	startTime: z.string().optional().or(z.literal("")),
	requiredCrewCount: z
		.string()
		.optional()
		.or(z.literal(""))
		.refine(
			(value) => !value || /^[1-9]\d*$/.test(value),
			"Required crew count must be a positive whole number",
		),
	location: z.string().max(500).optional().or(z.literal("")),
	notes: z.string().max(5000).optional().or(z.literal("")),
	additionalServices: z.array(z.string()).optional(),
	crewAssignments: z.array(crewAssignmentSchema).optional(),
});

export type ShootFormValues = z.infer<typeof shootFormSchema>;

// ============================================================================
// Types
// ============================================================================

interface BookingInfo {
	id: string;
	name: string;
	referenceNumber: string;
}

interface ShootFormProps {
	/** Default values for edit mode (mapped from API response) */
	defaultValues?: Partial<ShootFormValues>;
	/** Booking ID for create mode (from URL params) */
	defaultBookingId?: string;
	/** Booking info for edit mode (read-only display) */
	booking?: BookingInfo;
	onSubmit: (data: ShootFormValues) => Promise<void>;
	mode: "create" | "edit";
	isPending?: boolean;
	onScrollChange?: (isScrolled: boolean) => void;
}

// ============================================================================
// Component
// ============================================================================

export function ShootForm({
	defaultValues,
	defaultBookingId,
	booking,
	onSubmit,
	mode,
	isPending = false,
	onScrollChange,
}: ShootFormProps) {
	const [showNotes, setShowNotes] = useState(false);
	const { bookingReadOrReference } = useStudioCapabilities();
	const { openCreate: openConfigCreate } = useConfigurationParams();

	// ========================================================================
	// Data Fetching
	// ========================================================================

	const { data: bookingsData, isLoading: isLoadingBookings } = useQuery({
		...bookingsApi.listMinimalOptions({}),
		enabled: mode === "create" && bookingReadOrReference,
	});
	const bookings = bookingsData?.data ?? [];

	// Event types from configurations
	const { data: eventTypesData, isPending: eventTypesLoading } = useQuery(
		configurationsApi.eventTypesOptions(),
	);

	// Crews for assignments
	const { data: crews = [] } = useAllCrewOptions();

	// ========================================================================
	// Form Setup
	// ========================================================================

	const form = useForm<ShootFormValues>({
		resolver: zodResolver(shootFormSchema),
		defaultValues: {
			bookingId: defaultBookingId ?? "",
			bookingEventId: "",
			shootType: "",
			side: "common",
			shootDate: "",
			startTime: "",
			requiredCrewCount: "",
			location: "",
			notes: "",
			additionalServices: [],
			crewAssignments: [],
		},
	});

	// Crew assignments field array
	const {
		fields: crewAssignmentFields,
		append: appendCrewAssignment,
		remove: removeCrewAssignment,
	} = useFieldArray({
		control: form.control,
		name: "crewAssignments",
	});

	// Reset form when defaultValues change (edit mode)
	useEffect(() => {
		if (defaultValues) {
			form.reset({
				bookingId: defaultValues.bookingId ?? "",
				bookingEventId: defaultValues.bookingEventId ?? "",
				shootType: defaultValues.shootType ?? "",
				side: defaultValues.side ?? "common",
				shootDate: defaultValues.shootDate ?? "",
				startTime: defaultValues.startTime ?? "",
				requiredCrewCount: defaultValues.requiredCrewCount ?? "",
				location: defaultValues.location ?? "",
				notes: defaultValues.notes ?? "",
				additionalServices: defaultValues.additionalServices ?? [],
				crewAssignments: defaultValues.crewAssignments ?? [],
			});
			// Auto-expand notes if there's content
			if (defaultValues.notes) {
				setShowNotes(true);
			}
		}
	}, [defaultValues, form]);

	// ========================================================================
	// Computed Values
	// ========================================================================

	const isSubmitting = form.formState.isSubmitting || isPending;
	const notesValue = form.watch("notes");
	const selectedBookingId = form.watch("bookingId");
	const { data: bookingDetails, isLoading: isLoadingBookingEvents } =
		useQuery({
			...bookingsApi.getOptions(selectedBookingId),
			enabled: Boolean(selectedBookingId) && bookingReadOrReference,
		});

	// Event type options from configurations
	const eventTypeOptions = useMemo((): ComboboxOption[] => {
		const allEventTypes = eventTypesData?.data ?? [];
		return allEventTypes.map((et) => ({
			value: et.key,
			label: et.label,
		}));
	}, [eventTypesData]);

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

	const bookingEventOptions = useMemo((): ComboboxOption[] => {
		const events = bookingDetails?.data?.events ?? [];
		return [
			{ value: "__none", label: "No linked booking event" },
			...events.map((event) => ({
				value: event.id,
				label: `${event.eventType} · ${
					event.eventDate?.slice(0, 10) ??
					event.dateWindow ??
					"Date TBD"
				}`,
				description:
					EVENT_SIDE_OPTIONS.find(
						(option) => option.value === event.side,
					)?.label ?? event.side,
			})),
		];
	}, [bookingDetails?.data?.events]);

	// Crew options with filtering for already-assigned
	const currentAssignments = form.watch("crewAssignments") ?? [];
	const selectedCrewIds = currentAssignments.map((a) => a.crewId);

	const crewMap = useMemo(
		() => new Map(crews.map((c) => [c.id, c])),
		[crews],
	);

	const getAvailableCrews = useCallback(
		(currentCrewId?: string): ComboboxOption[] => {
			return crews
				.filter((crew) => {
					if (crew.id === currentCrewId) {
						return true;
					}
					return !selectedCrewIds.includes(crew.id);
				})
				.map((crew) => ({
					value: crew.id,
					label: crew.name,
				}));
		},
		[crews, selectedCrewIds],
	);

	// ========================================================================
	// Handlers
	// ========================================================================

	const handleScroll = useCallback(
		(event: React.UIEvent<HTMLDivElement>) => {
			const target = event.target as HTMLDivElement;
			const isScrolled = target.scrollTop > 0;
			onScrollChange?.(isScrolled);
		},
		[onScrollChange],
	);

	const handleCrewSelect = useCallback(
		(assignmentIndex: number, crewId: string) => {
			const crew = crewMap.get(crewId);
			form.setValue(`crewAssignments.${assignmentIndex}.crewId`, crewId);
			// Auto-populate rate from crew's dailyRate
			if (crew?.dailyRate) {
				form.setValue(
					`crewAssignments.${assignmentIndex}.rate`,
					crew.dailyRate,
				);
			}
		},
		[crewMap, form],
	);

	const addCrewAssignment = useCallback(() => {
		appendCrewAssignment({ crewId: "", rate: "" });
	}, [appendCrewAssignment]);

	// ========================================================================
	// Render
	// ========================================================================

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
										Booking {mode === "create" && "*"}
									</FieldLabel>
									<Combobox
										id={field.name}
										value={field.value}
										onValueChange={(value) => {
											field.onChange(value);
											form.setValue("bookingEventId", "");
										}}
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

						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<Controller
								name="bookingEventId"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={field.name}>
											Booking Event
										</FieldLabel>
										<Combobox
											id={field.name}
											value={field.value || "__none"}
											onValueChange={(value) => {
												const nextId =
													value === "__none"
														? ""
														: value;
												field.onChange(nextId);
												const event =
													bookingDetails?.data?.events.find(
														(item) =>
															item.id === nextId,
													);
												if (event) {
													form.setValue(
														"side",
														event.side as EventSide,
													);
												}
											}}
											options={bookingEventOptions}
											placeholder={
												isLoadingBookingEvents
													? "Loading events..."
													: "Link a booking event"
											}
											disabled={
												!selectedBookingId ||
												isLoadingBookingEvents
											}
										/>
									</Field>
								)}
							/>

							<Controller
								name="side"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={field.name}>
											Side
										</FieldLabel>
										<Combobox
											id={field.name}
											value={field.value}
											onValueChange={field.onChange}
											options={[...EVENT_SIDE_OPTIONS]}
											placeholder="Select side"
										/>
									</Field>
								)}
							/>
						</div>

						<div className="grid grid-cols-3 gap-4">
							<Controller
								name="shootType"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={field.name}>
											Event Type *
										</FieldLabel>
										<Combobox
											id={field.name}
											value={field.value}
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
													openConfigCreate(
														"event_type",
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
								name="shootDate"
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
								name="startTime"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={field.name}>
											Time
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

						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<Controller
								name="requiredCrewCount"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={field.name}>
											Required Crew Count
										</FieldLabel>
										<InputGroup>
											<InputGroupInput
												id={field.name}
												type="number"
												min="1"
												step="1"
												value={field.value ?? ""}
												onChange={(e) =>
													field.onChange(
														e.target.value,
													)
												}
												placeholder="e.g. 4"
												aria-invalid={
													fieldState.invalid
												}
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
								name="additionalServices"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={field.name}>
											Extra Services
										</FieldLabel>
										<MultiSelectCombobox
											id={field.name}
											options={[
												...SHOOT_EXTRA_SERVICE_OPTIONS,
											]}
											value={field.value ?? []}
											onValueChange={field.onChange}
											placeholder="Select extra services"
											searchPlaceholder="Search services..."
											emptyText="No extra services found"
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

						{/* Location */}
						<Controller
							name="location"
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
										<FieldError
											errors={[fieldState.error]}
										/>
									)}
								</Field>
							)}
						/>

						{/* Notes (Collapsible) */}
						{(showNotes || notesValue) && (
							<Controller
								name="notes"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<div className="flex items-center justify-between">
											<FieldLabel htmlFor={field.name}>
												Notes
											</FieldLabel>
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

						{/* Crew Assignments */}
						<Field>
							<FieldLabel>Crew Assignments</FieldLabel>
							{crewAssignmentFields.length === 0 ? (
								<div className="flex items-center gap-3 py-6 px-4 border border-dashed rounded-lg">
									<UsersIcon className="h-8 w-8 text-muted-foreground/50 shrink-0" />
									<div className="text-left">
										<p className="text-sm text-muted-foreground">
											No crew assigned yet
										</p>
										{form.watch("requiredCrewCount") && (
											<p className="text-xs text-muted-foreground">
												Required:{" "}
												{form.watch(
													"requiredCrewCount",
												)}
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
													name={`crewAssignments.${assignmentIndex}.crewId`}
													control={form.control}
													render={({
														field,
														fieldState,
													}) => (
														<Combobox
															value={
																field.value ??
																""
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
														/>
													)}
												/>

												{/* Rate Input */}
												<Controller
													name={`crewAssignments.${assignmentIndex}.rate`}
													control={form.control}
													render={({
														field,
														fieldState,
													}) => (
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

						{(form.watch("additionalServices")?.length ?? 0) >
							0 && (
							<p className="text-xs text-muted-foreground">
								Extra services:{" "}
								{(form.watch("additionalServices") ?? [])
									.map((service) =>
										getShootExtraServiceLabel(service),
									)
									.join(", ")}
							</p>
						)}
					</FieldGroup>
				</div>
			</ScrollArea>

			<div className="shrink-0 border-t p-4 bg-background">
				<FormActions
					mode={mode}
					isSubmitting={isSubmitting}
					submitLabel={mode === "edit" ? "Save Changes" : "Add Shoot"}
				/>
			</div>
		</form>
	);
}
