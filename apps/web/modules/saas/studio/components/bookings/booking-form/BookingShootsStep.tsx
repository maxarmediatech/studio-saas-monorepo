"use client";

import { Badge } from "@repo/ui/components/badge";
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Separator } from "@repo/ui/components/separator";
import { Textarea } from "@repo/ui/components/textarea";
import { useQuery } from "@tanstack/react-query";
import {
	CameraIcon,
	ClockIcon,
	MapPinIcon,
	PlusIcon,
	TrashIcon,
	UsersIcon,
} from "lucide-react";
import { useMemo } from "react";
import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import {
	type BookingFormValues,
	SHOOT_TYPE_OPTIONS,
} from "./booking-form-schema";
import { bookingFormQueries } from "./booking-form-queries";

export function BookingShootsStep() {
	const form = useFormContext<BookingFormValues>();

	// Fetch crews and roles using centralized query options
	const { data: crewsData } = useQuery(bookingFormQueries.crews());
	const { data: crewRolesData } = useQuery(bookingFormQueries.crewRoles());

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
			name: "",
			shootType: "",
			shootDate: "",
			startTime: "",
			endTime: "",
			venue: "",
			venueAddress: "",
			notes: "",
			crewAssignments: [],
		});
	};

	return (
		<FieldGroup className="gap-6">
			<Card>
				<CardHeader className="flex flex-row items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							<CameraIcon className="h-5 w-5" />
							Shoots
						</CardTitle>
						<p className="text-sm text-muted-foreground mt-1">
							Schedule photo/video shoots for this booking
						</p>
					</div>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={addNewShoot}
					>
						<PlusIcon className="mr-2 h-4 w-4" />
						Add Shoot
					</Button>
				</CardHeader>
				<CardContent>
					<FieldSet>
						{shoots.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-12 text-center border border-dashed rounded-lg">
								<CameraIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
								<p className="text-sm text-muted-foreground mb-4">
									No shoots scheduled yet. Click "Add Shoot" to
									schedule photo/video sessions.
								</p>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={addNewShoot}
								>
									<PlusIcon className="mr-2 h-4 w-4" />
									Add Shoot
								</Button>
							</div>
						) : (
							<FieldGroup className="gap-6">
								{shoots.map((shoot, shootIndex) => (
									<ShootCard
										key={shoot.id}
										shootIndex={shootIndex}
										crews={crews}
										crewRoles={crewRoles}
										onRemove={() => removeShoot(shootIndex)}
										canRemove={shoots.length > 0}
									/>
								))}
							</FieldGroup>
						)}
					</FieldSet>
				</CardContent>
			</Card>
		</FieldGroup>
	);
}

interface ShootCardProps {
	shootIndex: number;
	crews: Array<{
		id: string;
		name: string;
		role: string;
		phoneNumber?: string | null;
	}>;
	crewRoles: Array<{ id: string; key: string; label: string }>;
	onRemove: () => void;
	canRemove: boolean;
}

function ShootCard({
	shootIndex,
	crews,
	crewRoles,
	onRemove,
	canRemove,
}: ShootCardProps) {
	const form = useFormContext<BookingFormValues>();

	const {
		fields: crewAssignments,
		append: appendCrewAssignment,
		remove: removeCrewAssignment,
	} = useFieldArray({
		control: form.control,
		name: `shoots.${shootIndex}.crewAssignments`,
	});

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between pb-4">
				<div className="flex items-center gap-2">
					<CameraIcon className="h-5 w-5 text-muted-foreground" />
					<CardTitle className="text-base">
						Shoot {shootIndex + 1}
					</CardTitle>
				</div>
				{canRemove && (
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="min-h-11 min-w-11 text-destructive hover:text-destructive hover:bg-destructive/10"
						onClick={onRemove}
					>
						<TrashIcon className="h-4 w-4" />
						<span className="sr-only">Remove shoot</span>
					</Button>
				)}
			</CardHeader>
			<CardContent className="space-y-6">
				{/* Basic Info */}
				<FieldGroup>
					<div className="grid gap-4 md:grid-cols-3">
						{/* Shoot Name */}
						<Controller
							name={`shoots.${shootIndex}.name`}
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor={field.name}>
										Shoot Name
									</FieldLabel>
									<Input
										{...field}
										id={field.name}
										placeholder="e.g. Wedding Day Photography"
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

						{/* Shoot Type */}
						<Controller
							name={`shoots.${shootIndex}.shootType`}
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor={field.name}>
										Shoot Type
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
											{SHOOT_TYPE_OPTIONS.map((type) => (
												<SelectItem
													key={type.value}
													value={type.value}
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

						{/* Shoot Date */}
						<Controller
							name={`shoots.${shootIndex}.shootDate`}
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor={field.name}>
										Date
									</FieldLabel>
									<Input
										{...field}
										id={field.name}
										type="date"
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

					{/* Time and Location */}
					<div className="grid gap-4 md:grid-cols-4">
						{/* Start Time */}
						<Controller
							name={`shoots.${shootIndex}.startTime`}
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor={field.name}>
										<ClockIcon className="h-3.5 w-3.5 inline mr-1" />
										Start Time
									</FieldLabel>
									<Input
										{...field}
										id={field.name}
										type="time"
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

						{/* End Time */}
						<Controller
							name={`shoots.${shootIndex}.endTime`}
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor={field.name}>
										End Time
									</FieldLabel>
									<Input
										{...field}
										id={field.name}
										type="time"
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

						{/* Venue */}
						<Controller
							name={`shoots.${shootIndex}.venue`}
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor={field.name}>
										<MapPinIcon className="h-3.5 w-3.5 inline mr-1" />
										Venue
									</FieldLabel>
									<Input
										{...field}
										id={field.name}
										placeholder="e.g. Grand Ballroom"
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

						{/* Venue Address */}
						<Controller
							name={`shoots.${shootIndex}.venueAddress`}
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor={field.name}>
										Address
									</FieldLabel>
									<Input
										{...field}
										id={field.name}
										placeholder="Full address"
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

					{/* Notes */}
					<Controller
						name={`shoots.${shootIndex}.notes`}
						control={form.control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid}>
								<FieldLabel htmlFor={field.name}>
									Notes
								</FieldLabel>
								<Textarea
									{...field}
									id={field.name}
									placeholder="Any special instructions for this shoot"
									rows={2}
									aria-invalid={fieldState.invalid}
								/>
								{fieldState.invalid && (
									<FieldError errors={[fieldState.error]} />
								)}
							</Field>
						)}
					/>
				</FieldGroup>

				<Separator />

				{/* Crew Assignments */}
				<div>
					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center gap-2">
							<UsersIcon className="h-4 w-4 text-muted-foreground" />
							<h4 className="text-sm font-medium">
								Crew Assignments
							</h4>
							{crewAssignments.length > 0 && (
								<Badge variant="secondary" className="ml-2">
									{crewAssignments.length} assigned
								</Badge>
							)}
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
							<PlusIcon className="mr-2 h-4 w-4" />
							Assign Crew
						</Button>
					</div>

					{crewAssignments.length === 0 ? (
						<p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
							No crew assigned yet. Click "Assign Crew" to add
							team members.
						</p>
					) : (
						<FieldGroup className="gap-3">
							{crewAssignments.map(
								(assignment, assignmentIndex) => (
									<div
										key={assignment.id}
										className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
									>
										{/* Crew Member */}
										<div className="flex-1">
											<Controller
												name={`shoots.${shootIndex}.crewAssignments.${assignmentIndex}.crewId`}
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
															className="text-xs"
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
																		(
																			crew,
																		) => (
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
										</div>

										{/* Role */}
										<div className="flex-1">
											<Controller
												name={`shoots.${shootIndex}.crewAssignments.${assignmentIndex}.role`}
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
															className="text-xs"
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
																		(
																			role,
																		) => (
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
										</div>

										{/* Is Lead Toggle */}
										<div className="flex items-end pb-2">
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
														className="h-9"
													>
														{field.value
															? "Lead"
															: "Set Lead"}
													</Button>
												)}
											/>
										</div>

										{/* Remove - 44px touch target (WCAG 2.5.5) */}
										<div className="flex items-end pb-2">
											<Button
												type="button"
												variant="ghost"
												size="icon"
												className="min-h-11 min-w-11 text-destructive hover:text-destructive hover:bg-destructive/10"
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
									</div>
								),
							)}
						</FieldGroup>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
