"use client";

import { useFieldArray, useFormContext, Controller } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
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
import { Badge } from "@repo/ui/components/badge";
import {
	PackageIcon,
	PlusIcon,
	TrashIcon,
	UsersIcon,
	CalendarIcon,
} from "lucide-react";
import { crewsApi } from "@saas/studio/lib/api";
import {
	type BookingFormValues,
	DELIVERABLE_TYPE_OPTIONS,
} from "./booking-form-schema";

export function BookingDeliverablesStep() {
	const form = useFormContext<BookingFormValues>();

	// Fetch crews for assignment
	const { data: crewsData } = useQuery(crewsApi.listOptions({ limit: 100 }));
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
		});
	};

	return (
		<FieldGroup className="gap-6">
			<Card>
				<CardHeader className="flex flex-row items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							<PackageIcon className="h-5 w-5" />
							Deliverables
						</CardTitle>
						<p className="text-sm text-muted-foreground mt-1">
							Define what will be delivered to the client
						</p>
					</div>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={addNewDeliverable}
					>
						<PlusIcon className="mr-2 h-4 w-4" />
						Add Deliverable
					</Button>
				</CardHeader>
				<CardContent>
					<FieldSet>
						{deliverables.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-12 text-center border border-dashed rounded-lg">
								<PackageIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
								<p className="text-sm text-muted-foreground mb-4">
									No deliverables added yet. Click "Add Deliverable" to define
									what will be delivered.
								</p>
								{/* Quick add common deliverables */}
								<div className="flex flex-wrap gap-2 justify-center max-w-md">
									{DELIVERABLE_TYPE_OPTIONS.slice(0, 4).map((type) => (
										<Button
											key={type.value}
											type="button"
											variant="outline"
											size="sm"
											onClick={() =>
												appendDeliverable({
													name: type.label,
													deliverableType: type.value,
													description: "",
													dueDate: "",
													crewAssignments: [],
												})
											}
										>
											<PlusIcon className="mr-1 h-3 w-3" />
											{type.label}
										</Button>
									))}
								</div>
							</div>
						) : (
							<FieldGroup className="gap-6">
								{deliverables.map((deliverable, index) => (
									<DeliverableCard
										key={deliverable.id}
										deliverableIndex={index}
										crews={crews}
										onRemove={() => removeDeliverable(index)}
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

interface DeliverableCardProps {
	deliverableIndex: number;
	crews: Array<{
		id: string;
		name: string;
		role: string;
		phoneNumber?: string | null;
	}>;
	onRemove: () => void;
}

function DeliverableCard({
	deliverableIndex,
	crews,
	onRemove,
}: DeliverableCardProps) {
	const form = useFormContext<BookingFormValues>();

	const {
		fields: crewAssignments,
		append: appendCrewAssignment,
		remove: removeCrewAssignment,
	} = useFieldArray({
		control: form.control,
		name: `deliverables.${deliverableIndex}.crewAssignments`,
	});

	return (
		<Card className="relative">
			<CardHeader className="flex flex-row items-center justify-between pb-4">
				<div className="flex items-center gap-2">
					<PackageIcon className="h-5 w-5 text-muted-foreground" />
					<CardTitle className="text-base">
						Deliverable {deliverableIndex + 1}
					</CardTitle>
				</div>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="min-h-11 min-w-11 text-destructive hover:text-destructive hover:bg-destructive/10"
					onClick={onRemove}
				>
					<TrashIcon className="h-4 w-4" />
					<span className="sr-only">Remove deliverable</span>
				</Button>
			</CardHeader>
			<CardContent className="space-y-6">
				{/* Basic Info */}
				<FieldGroup>
					<div className="grid gap-4 md:grid-cols-3">
						{/* Deliverable Name */}
						<Controller
							name={`deliverables.${deliverableIndex}.name`}
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor={field.name}>Name</FieldLabel>
									<Input
										{...field}
										id={field.name}
										placeholder="e.g. Wedding Album"
										aria-invalid={fieldState.invalid}
									/>
									{fieldState.invalid && (
										<FieldError errors={[fieldState.error]} />
									)}
								</Field>
							)}
						/>

						{/* Deliverable Type */}
						<Controller
							name={`deliverables.${deliverableIndex}.deliverableType`}
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor={field.name}>Type</FieldLabel>
									<Select onValueChange={field.onChange} value={field.value}>
										<SelectTrigger
											id={field.name}
											aria-invalid={fieldState.invalid}
										>
											<SelectValue placeholder="Select type" />
										</SelectTrigger>
										<SelectContent>
											{DELIVERABLE_TYPE_OPTIONS.map((type) => (
												<SelectItem key={type.value} value={type.value}>
													{type.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									{fieldState.invalid && (
										<FieldError errors={[fieldState.error]} />
									)}
								</Field>
							)}
						/>

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
									<Input
										{...field}
										id={field.name}
										type="date"
										aria-invalid={fieldState.invalid}
									/>
									{fieldState.invalid && (
										<FieldError errors={[fieldState.error]} />
									)}
								</Field>
							)}
						/>
					</div>

					{/* Description */}
					<Controller
						name={`deliverables.${deliverableIndex}.description`}
						control={form.control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid}>
								<FieldLabel htmlFor={field.name}>Description</FieldLabel>
								<Textarea
									{...field}
									id={field.name}
									placeholder="Details about this deliverable (specifications, requirements, etc.)"
									rows={2}
									aria-invalid={fieldState.invalid}
								/>
								<FieldDescription>
									Include any specific requirements or specifications
								</FieldDescription>
								{fieldState.invalid && (
									<FieldError errors={[fieldState.error]} />
								)}
							</Field>
						)}
					/>
				</FieldGroup>

				{/* Crew Assignments */}
				<div className="border-t pt-4">
					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center gap-2">
							<UsersIcon className="h-4 w-4 text-muted-foreground" />
							<h4 className="text-sm font-medium">Assigned Team</h4>
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
									isLead: false,
								})
							}
						>
							<PlusIcon className="mr-2 h-4 w-4" />
							Assign Team Member
						</Button>
					</div>

					{crewAssignments.length === 0 ? (
						<p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
							No team assigned yet. Click "Assign Team Member" to add editors,
							designers, etc.
						</p>
					) : (
						<FieldGroup className="gap-3">
							{crewAssignments.map((assignment, assignmentIndex) => (
								<div
									key={assignment.id}
									className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
								>
									{/* Crew Member */}
									<div className="flex-1">
										<Controller
											name={`deliverables.${deliverableIndex}.crewAssignments.${assignmentIndex}.crewId`}
											control={form.control}
											render={({ field, fieldState }) => (
												<Field data-invalid={fieldState.invalid}>
													<FieldLabel htmlFor={field.name} className="text-xs">
														Team Member
													</FieldLabel>
													<Select
														onValueChange={field.onChange}
														value={field.value}
													>
														<SelectTrigger
															id={field.name}
															aria-invalid={fieldState.invalid}
														>
															<SelectValue placeholder="Select team member" />
														</SelectTrigger>
														<SelectContent>
															{crews.length > 0 ? (
																crews.map((crew) => (
																	<SelectItem key={crew.id} value={crew.id}>
																		<div className="flex flex-col">
																			<span>{crew.name}</span>
																			<span className="text-xs text-muted-foreground">
																				{crew.role}
																			</span>
																		</div>
																	</SelectItem>
																))
															) : (
																<div className="p-2 text-sm text-muted-foreground text-center">
																	No team members found
																</div>
															)}
														</SelectContent>
													</Select>
													{fieldState.invalid && (
														<FieldError errors={[fieldState.error]} />
													)}
												</Field>
											)}
										/>
									</div>

									{/* Is Lead Toggle */}
									<div className="flex items-end pb-2">
										<Controller
											name={`deliverables.${deliverableIndex}.crewAssignments.${assignmentIndex}.isLead`}
											control={form.control}
											render={({ field }) => (
												<Button
													type="button"
													variant={field.value ? "default" : "outline"}
													size="sm"
													onClick={() => field.onChange(!field.value)}
													className="h-9"
												>
													{field.value ? "Lead" : "Set Lead"}
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
											onClick={() => removeCrewAssignment(assignmentIndex)}
										>
											<TrashIcon className="h-4 w-4" />
											<span className="sr-only">Remove assignment</span>
										</Button>
									</div>
								</div>
							))}
						</FieldGroup>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
