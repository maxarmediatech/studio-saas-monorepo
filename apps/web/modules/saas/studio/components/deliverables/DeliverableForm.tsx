"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { DeliverableDetail } from "@repo/api/modules/studio/schemas/deliverable";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Combobox, type ComboboxOption } from "@repo/ui/components/combobox";
import { DatePicker } from "@repo/ui/components/date-picker";
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
	InputGroupInput,
	InputGroupText,
} from "@repo/ui/components/input-group";
import { MultiSelectCombobox } from "@repo/ui/components/multi-select-combobox";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Textarea } from "@repo/ui/components/textarea";
import { useStudioCapabilities } from "@saas/studio/components/studio-capabilities-context";
import { bookingsApi, crewsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { ChevronDownIcon, ChevronUpIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { FormActions } from "../ui/FormActions";

function getInitials(name: string): string {
	return name
		.split(" ")
		.map((part) => part[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
}

const crewAssignmentSchema = z.object({
	crewId: z.string().min(1, "Crew member is required"),
});

const deliverableFormSchema = z.object({
	bookingId: z.string().min(1, "Booking is required"),
	name: z.string().min(1, "Name is required").max(255),
	quantity: z.number().int().min(1).default(1),
	cost: z.string().optional().or(z.literal("")),
	dueDate: z.string().optional().or(z.literal("")),
	status: z.string().optional().default("pending"),
	description: z.string().max(5000).optional().or(z.literal("")),
	crewAssignments: z.array(crewAssignmentSchema).optional(),
});

export type DeliverableFormValues = z.input<typeof deliverableFormSchema>;

interface BookingInfo {
	id: string;
	name: string;
	referenceNumber: string;
}

interface DeliverableFormProps {
	defaultValues?: DeliverableDetail;
	defaultBookingId?: string;
	booking?: BookingInfo;
	existingAssignments?: Array<{
		crewId: string;
		crew: { id: string; name: string };
	}>;
	onSubmit: (data: DeliverableFormValues) => Promise<void>;
	mode: "create" | "edit";
	isPending?: boolean;
	onScrollChange?: (isScrolled: boolean) => void;
}

interface CrewOption {
	value: string;
	label: string;
}

export function DeliverableForm({
	defaultValues,
	defaultBookingId,
	booking,
	existingAssignments,
	onSubmit,
	mode,
	isPending = false,
	onScrollChange,
}: DeliverableFormProps) {
	const [showDetails, setShowDetails] = useState(false);
	const { bookingReadOrList } = useStudioCapabilities();

	const form = useForm<DeliverableFormValues>({
		resolver: zodResolver(deliverableFormSchema),
		defaultValues: {
			bookingId: defaultBookingId ?? "",
			name: "",
			quantity: 1,
			cost: "",
			dueDate: "",
			status: "pending",
			description: "",
			crewAssignments: [],
		},
	});

	const { data: bookingsData, isLoading: isLoadingBookings } = useQuery({
		...bookingsApi.listMinimalOptions({}),
		enabled: mode === "create" && bookingReadOrList,
	});
	const bookings = bookingsData?.data ?? [];

	const { data: crewsData } = useQuery(crewsApi.listOptions({}));
	const crews = crewsData?.data ?? [];

	const crewOptions: CrewOption[] = useMemo(
		() =>
			crews.map((crew) => ({
				value: crew.id,
				label: crew.name,
			})),
		[crews],
	);

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

	useEffect(() => {
		if (defaultValues) {
			const assignments =
				existingAssignments?.map((a) => ({
					crewId: a.crewId,
				})) ?? [];

			form.reset({
				bookingId: defaultValues.bookingId,
				name: defaultValues.name,
				quantity: defaultValues.quantity ?? 1,
				cost: defaultValues.cost ?? "",
				dueDate: defaultValues.dueDate ?? "",
				status: defaultValues.status ?? "pending",
				description: defaultValues.description ?? "",
				crewAssignments: assignments,
			});

			if (defaultValues.description || assignments.length > 0) {
				setShowDetails(true);
			}
		}
	}, [defaultValues, existingAssignments, form]);

	const isSubmitting = form.formState.isSubmitting || isPending;

	const descriptionValue = form.watch("description");
	const crewAssignments = form.watch("crewAssignments") ?? [];

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
										onValueChange={field.onChange}
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

						<div className="grid gap-4 md:grid-cols-4">
							<div className="md:col-span-2">
								<Controller
									name="name"
									control={form.control}
									render={({ field, fieldState }) => (
										<Field
											data-invalid={fieldState.invalid}
										>
											<FieldLabel htmlFor={field.name}>
												Name *
											</FieldLabel>
											<Input
												{...field}
												id={field.name}
												placeholder="e.g. Wedding Album"
												aria-invalid={
													fieldState.invalid
												}
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

							<Controller
								name="quantity"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={field.name}>
											Qty
										</FieldLabel>
										<Input
											id={field.name}
											name={field.name}
											ref={field.ref}
											onBlur={field.onBlur}
											type="number"
											min={1}
											value={String(field.value ?? 1)}
											onChange={(e) =>
												field.onChange(
													Number(e.target.value) || 1,
												)
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

							<Controller
								name="cost"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={field.name}>
											Cost
										</FieldLabel>
										<InputGroup>
											<InputGroupAddon>
												<InputGroupText>
													₹
												</InputGroupText>
											</InputGroupAddon>
											<InputGroupInput
												{...field}
												id={field.name}
												placeholder="0.00"
												value={field.value ?? ""}
												aria-invalid={
													fieldState.invalid
												}
												onChange={(e) => {
													const value =
														e.target.value.replace(
															/[^0-9.]/g,
															"",
														);
													const parts =
														value.split(".");
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
						</div>

						<div className="grid gap-4 md:grid-cols-2">
							<Controller
								name="dueDate"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={field.name}>
											Due Date
										</FieldLabel>
										<DatePicker
											id={field.name}
											value={field.value || undefined}
											onValueChange={field.onChange}
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
								name="status"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={field.name}>
											Status
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
												<SelectValue placeholder="Select status" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="pending">
													Pending
												</SelectItem>
												<SelectItem value="in_progress">
													In Progress
												</SelectItem>
												<SelectItem value="completed">
													Completed
												</SelectItem>
												<SelectItem value="delivered">
													Delivered
												</SelectItem>
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

						{(showDetails ||
							descriptionValue ||
							crewAssignments.length > 0) && (
							<>
								<Controller
									name="description"
									control={form.control}
									render={({ field, fieldState }) => (
										<Field
											data-invalid={fieldState.invalid}
										>
											<div className="flex items-center justify-between">
												<FieldLabel
													htmlFor={field.name}
												>
													Notes
												</FieldLabel>
												{showDetails &&
													!descriptionValue &&
													crewAssignments.length ===
														0 && (
														<Button
															type="button"
															variant="ghost"
															size="sm"
															className="h-auto py-0 px-1 text-muted-foreground"
															onClick={() =>
																setShowDetails(
																	false,
																)
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
												placeholder="Details about this deliverable (specifications, requirements, etc.)"
												rows={2}
												aria-invalid={
													fieldState.invalid
												}
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
									name="crewAssignments"
									control={form.control}
									render={({ field }) => {
										const selectedIds = (
											field.value ?? []
										).map((a) => a.crewId);

										return (
											<Field>
												<FieldLabel>
													Assigned Team
												</FieldLabel>
												<MultiSelectCombobox
													options={crewOptions}
													value={selectedIds}
													onValueChange={(ids) => {
														field.onChange(
															ids.map((id) => ({
																crewId: id,
															})),
														);
													}}
													placeholder="Select team members..."
													searchPlaceholder="Search team..."
													emptyText="No team members found"
													renderOption={(option) => (
														<div className="flex items-center gap-2">
															<Avatar className="h-6 w-6">
																<AvatarFallback className="text-[10px]">
																	{getInitials(
																		option.label,
																	)}
																</AvatarFallback>
															</Avatar>
															<span>
																{option.label}
															</span>
														</div>
													)}
													renderSelectedItem={(
														option,
														onRemove,
													) => (
														<Badge
															variant="secondary"
															className="flex items-center gap-1.5 pr-1"
														>
															<Avatar className="h-4 w-4">
																<AvatarFallback className="text-[8px]">
																	{getInitials(
																		option.label,
																	)}
																</AvatarFallback>
															</Avatar>
															<span className="truncate">
																{option.label}
															</span>
															<button
																type="button"
																onClick={(
																	e,
																) => {
																	e.stopPropagation();
																	onRemove();
																}}
																className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
															>
																<XIcon className="size-3" />
																<span className="sr-only">
																	Remove{" "}
																	{
																		option.label
																	}
																</span>
															</button>
														</Badge>
													)}
												/>
											</Field>
										);
									}}
								/>
							</>
						)}

						{!showDetails &&
							!descriptionValue &&
							crewAssignments.length === 0 && (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="w-fit text-muted-foreground"
									onClick={() => setShowDetails(true)}
								>
									<ChevronDownIcon className="mr-1.5 h-3.5 w-3.5" />
									Additional details
								</Button>
							)}
					</FieldGroup>
				</div>
			</ScrollArea>

			<div className="shrink-0 border-t p-4 bg-background">
				<FormActions
					mode={mode}
					isSubmitting={isSubmitting}
					submitLabel={
						mode === "edit" ? "Save Changes" : "Add Deliverable"
					}
				/>
			</div>
		</form>
	);
}
