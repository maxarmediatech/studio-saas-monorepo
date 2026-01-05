"use client";

import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { DatePicker } from "@repo/ui/components/date-picker";
import {
	Field,
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
import { MultiSelectCombobox } from "@repo/ui/components/multi-select-combobox";
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
	CalendarIcon,
	PackageIcon,
	PlusIcon,
	TrashIcon,
	UsersIcon,
	XIcon,
} from "lucide-react";
import { useMemo } from "react";
import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import { bookingFormQueries } from "./booking-form-queries";
import {
	type BookingFormValues,
	DELIVERABLE_TYPE_OPTIONS,
} from "./booking-form-schema";

/**
 * Get initials from a name (e.g., "John Smith" -> "JS")
 */
function getInitials(name: string): string {
	return name
		.split(" ")
		.map((part) => part[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
}

/**
 * Crew option type for multi-select
 */
interface CrewOption {
	value: string;
	label: string;
	role: string;
}

export function BookingDeliverablesStep() {
	const form = useFormContext<BookingFormValues>();

	// Fetch crews using centralized query options
	const { data: crewsData } = useQuery(bookingFormQueries.crews());
	const crews = crewsData?.data ?? [];

	const {
		fields: deliverables,
		append: appendDeliverable,
		remove: removeDeliverable,
	} = useFieldArray({
		control: form.control,
		name: "deliverables",
	});

	const addNewDeliverable = () => {
		appendDeliverable({
			name: "",
			deliverableType: "",
			description: "",
			dueDate: "",
			crewAssignments: [],
			quantity: 1,
			cost: "",
			isPackageIncluded: false, // Custom deliverable
		});
	};

	// Separate package and custom deliverables for display purposes
	const watchedDeliverables = form.watch("deliverables") ?? [];
	const packageDeliverables = watchedDeliverables.filter(
		(d) => d.isPackageIncluded,
	);

	return (
		<Card className="shadow-none">
			<CardContent>
				<FieldSet>
					<FieldGroup>
						<Field orientation="responsive">
							<div className="flex-1">
								<FieldLegend>Deliverables</FieldLegend>
								<FieldDescription>
									{packageDeliverables.length > 0
										? "Package deliverables are included. Add custom deliverables below."
										: "Define what will be delivered to the client"}
								</FieldDescription>
							</div>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={addNewDeliverable}
							>
								<PlusIcon className="mr-2 h-4 w-4" />
								Add Custom Deliverable
							</Button>
						</Field>
					</FieldGroup>
					<FieldSeparator />
					<FieldGroup className="gap-4">
						{deliverables.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-3 py-8 px-4 border border-dashed rounded-lg">
								<PackageIcon className="h-10 w-10 text-muted-foreground/30" />
								<p className="text-sm text-muted-foreground text-center">
									No deliverables added yet
								</p>
								{/* Quick add common deliverables */}
								<div className="flex flex-wrap gap-2 justify-center">
									{DELIVERABLE_TYPE_OPTIONS.slice(0, 4).map(
										(type) => (
											<Button
												key={type.value}
												type="button"
												variant="outline"
												size="sm"
												onClick={() =>
													appendDeliverable({
														name: type.label,
														deliverableType:
															type.value,
														description: "",
														dueDate: "",
														crewAssignments: [],
														quantity: 1,
														cost: "",
														isPackageIncluded: false,
													})
												}
											>
												<PlusIcon className="mr-1 h-3 w-3" />
												{type.label}
											</Button>
										),
									)}
								</div>
							</div>
						) : (
							<FieldGroup className="gap-4">
								{deliverables.map((deliverable, index) => {
									const watchedDeliverable =
										watchedDeliverables[index];
									return (
										<DeliverableCard
											key={deliverable.id}
											deliverableIndex={index}
											crews={crews}
											isPackageIncluded={
												watchedDeliverable?.isPackageIncluded ??
												false
											}
											onRemove={() =>
												removeDeliverable(index)
											}
										/>
									);
								})}
							</FieldGroup>
						)}
					</FieldGroup>
				</FieldSet>
			</CardContent>
		</Card>
	);
}

interface DeliverableCardProps {
	deliverableIndex: number;
	crews: Array<{
		id: string;
		name: string;
		role: string;
		phoneNumber?: string | null;
	}>;
	isPackageIncluded: boolean;
	onRemove: () => void;
}

function DeliverableCard({
	deliverableIndex,
	crews,
	isPackageIncluded,
	onRemove,
}: DeliverableCardProps) {
	const form = useFormContext<BookingFormValues>();

	// Transform crews to multi-select options
	const crewOptions: CrewOption[] = useMemo(
		() =>
			crews.map((crew) => ({
				value: crew.id,
				label: crew.name,
				role: crew.role ?? "",
			})),
		[crews],
	);

	// Watch crew assignments for badge count
	const crewAssignments =
		form.watch(`deliverables.${deliverableIndex}.crewAssignments`) ?? [];

	return (
		<div
			className={`overflow-hidden rounded-lg border ${
				isPackageIncluded
					? "border-primary/30 bg-primary/5"
					: "bg-muted/10"
			}`}
		>
			<div className="flex items-center justify-between gap-2 border-b bg-muted/20 px-4 py-3">
				<div className="flex items-center gap-2">
					<PackageIcon className="h-4 w-4 text-muted-foreground" />
					<span className="text-sm font-medium">
						Deliverable {deliverableIndex + 1}
					</span>
					{isPackageIncluded && (
						<Badge variant="default">Package</Badge>
					)}
				</div>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
					onClick={onRemove}
				>
					<TrashIcon className="h-4 w-4" />
					<span className="sr-only">Remove deliverable</span>
				</Button>
			</div>
			<div className="p-4 space-y-4">
				{/* Basic Info */}
				<FieldGroup>
					{/* Row 1: Name, Type, Quantity */}
					<div className="grid gap-4 md:grid-cols-4">
						{/* Deliverable Name */}
						<div className="md:col-span-2">
							<Controller
								name={`deliverables.${deliverableIndex}.name`}
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={field.name}>
											Name
										</FieldLabel>
										<Input
											{...field}
											id={field.name}
											placeholder="e.g. Wedding Album"
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

						{/* Deliverable Type */}
						<Controller
							name={`deliverables.${deliverableIndex}.deliverableType`}
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor={field.name}>
										Type
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
											{DELIVERABLE_TYPE_OPTIONS.map(
												(type) => (
													<SelectItem
														key={type.value}
														value={type.value}
													>
														{type.label}
													</SelectItem>
												),
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

						{/* Quantity */}
						<Controller
							name={`deliverables.${deliverableIndex}.quantity`}
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
					</div>

					{/* Row 2: Due Date and Cost (cost only for custom deliverables) */}
					<div className="grid gap-4 md:grid-cols-3">
						{/* Due Date */}
						<Controller
							name={`deliverables.${deliverableIndex}.dueDate`}
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor={field.name}>
										<CalendarIcon className="h-3.5 w-3.5 inline mr-1" />
										Due Date
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

						{/* Cost - only for custom deliverables */}
						{!isPackageIncluded && (
							<Controller
								name={`deliverables.${deliverableIndex}.cost`}
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={field.name}>
											Cost
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
										</div>
										<FieldDescription>
											Additional cost for this deliverable
										</FieldDescription>
										{fieldState.invalid && (
											<FieldError
												errors={[fieldState.error]}
											/>
										)}
									</Field>
								)}
							/>
						)}

						{/* Show "Included" label for package deliverables */}
						{isPackageIncluded && (
							<Field>
								<FieldLabel>Cost</FieldLabel>
								<div className="flex items-center h-10 px-3 text-sm text-muted-foreground bg-muted/50 rounded-md border">
									Included in package
								</div>
							</Field>
						)}
					</div>

					{/* Description */}
					<Controller
						name={`deliverables.${deliverableIndex}.description`}
						control={form.control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid}>
								<FieldLabel htmlFor={field.name}>
									Description
								</FieldLabel>
								<Textarea
									{...field}
									id={field.name}
									placeholder="Details about this deliverable (specifications, requirements, etc.)"
									rows={2}
									aria-invalid={fieldState.invalid}
								/>
								<FieldDescription>
									Include any specific requirements or
									specifications
								</FieldDescription>
								{fieldState.invalid && (
									<FieldError errors={[fieldState.error]} />
								)}
							</Field>
						)}
					/>
				</FieldGroup>

				{/* Crew Assignments - Multi-select chips */}
				<FieldSeparator />
				<Field>
					<FieldTitle className="flex items-center gap-2">
						<UsersIcon className="h-4 w-4" />
						Assigned Team
						{crewAssignments.length > 0 && (
							<Badge variant="secondary">
								{crewAssignments.length} assigned
							</Badge>
						)}
					</FieldTitle>
					<Controller
						name={`deliverables.${deliverableIndex}.crewAssignments`}
						control={form.control}
						render={({ field }) => {
							// Extract current crew IDs from assignments
							const selectedIds = (field.value ?? []).map(
								(a) => a.crewId,
							);

							return (
								<MultiSelectCombobox
									options={crewOptions}
									value={selectedIds}
									onValueChange={(ids) => {
										// Convert IDs back to assignment objects
										field.onChange(
											ids.map((id) => ({ crewId: id })),
										);
									}}
									placeholder="Select team members..."
									searchPlaceholder="Search team..."
									emptyText="No team members found"
									renderOption={(option) => (
										<div className="flex items-center gap-2">
											<Avatar className="h-6 w-6">
												<AvatarFallback className="text-[10px]">
													{getInitials(option.label)}
												</AvatarFallback>
											</Avatar>
											<span>{option.label}</span>
											{option.role && (
												<span className="text-muted-foreground text-sm">
													({option.role})
												</span>
											)}
										</div>
									)}
									renderSelectedItem={(option, onRemove) => (
										<Badge
											variant="secondary"
											className="flex items-center gap-1.5 pr-1"
										>
											<Avatar className="h-4 w-4">
												<AvatarFallback className="text-[8px]">
													{getInitials(option.label)}
												</AvatarFallback>
											</Avatar>
											<span className="truncate">
												{option.label}
											</span>
											{option.role && (
												<span className="text-muted-foreground text-xs">
													({option.role})
												</span>
											)}
											<button
												type="button"
												onClick={(e) => {
													e.stopPropagation();
													onRemove();
												}}
												className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
											>
												<XIcon className="size-3" />
												<span className="sr-only">
													Remove {option.label}
												</span>
											</button>
										</Badge>
									)}
								/>
							);
						}}
					/>
				</Field>
			</div>
		</div>
	);
}
