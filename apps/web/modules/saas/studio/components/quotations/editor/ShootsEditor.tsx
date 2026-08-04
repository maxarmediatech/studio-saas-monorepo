import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { MultiSelectCombobox } from "@repo/ui/components/multi-select-combobox";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Textarea } from "@repo/ui/components/textarea";
import { SHOOT_EXTRA_SERVICE_OPTIONS } from "@saas/studio/lib/shoot-planning";
import { CrewAssignmentsEditor } from "./CrewAssignmentsEditor";
import { OperationCard, OperationSection } from "./OperationSection";
import type { BookingDraft, ConfigurationOption, CrewOption } from "./types";

const serviceOptions = [...SHOOT_EXTRA_SERVICE_OPTIONS];

export function ShootsEditor({
	booking,
	eventTypes,
	crews,
	onChange,
	error,
}: {
	booking: BookingDraft;
	eventTypes: ConfigurationOption[];
	crews: CrewOption[];
	onChange: (booking: BookingDraft) => void;
	error?: string;
}) {
	const shoots = booking.shoots ?? [];
	const updateShoot = (
		index: number,
		value: Partial<(typeof shoots)[number]>,
	) =>
		onChange({
			...booking,
			shoots: shoots.map((item, itemIndex) =>
				itemIndex === index ? { ...item, ...value } : item,
			),
		});
	return (
		<OperationSection
			id="quotation-shoots"
			error={error}
			title="Shoots & crew"
			description="Production sessions, coverage needs, and assigned crew."
			isEmpty={shoots.length === 0}
			onAdd={() =>
				onChange({
					...booking,
					shoots: [
						...shoots,
						{
							name: "",
							shootType: "",
							shootDate: booking.bookingDate,
							startTime: "",
							endTime: "",
							venue: "",
							venueAddress: "",
							notes: "",
							additionalServices: [],
							status: "scheduled",
							crewAssignments: [],
						},
					],
				})
			}
		>
			<FieldGroup className="gap-3">
				{shoots.map((shoot, index) => (
					<OperationCard
						key={index}
						onRemove={() =>
							onChange({
								...booking,
								shoots: shoots.filter(
									(_, itemIndex) => itemIndex !== index,
								),
							})
						}
					>
						<div className="grid gap-3 sm:grid-cols-4">
							<Input
								aria-label="Shoot name"
								value={shoot.name}
								placeholder="Shoot name"
								onChange={(event) =>
									updateShoot(index, {
										name: event.target.value,
									})
								}
							/>
							<Select
								value={shoot.shootType || undefined}
								onValueChange={(shootType) =>
									updateShoot(index, { shootType })
								}
							>
								<SelectTrigger
									aria-label="Shoot type"
									className="w-full"
								>
									<SelectValue placeholder="Shoot type" />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										<SelectLabel>Event types</SelectLabel>
										{eventTypes.map((item) => (
											<SelectItem
												key={item.key}
												value={item.key}
											>
												{item.label}
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
							<Input
								aria-label="Shoot date"
								type="date"
								value={shoot.shootDate}
								onChange={(event) =>
									updateShoot(index, {
										shootDate: event.target.value,
									})
								}
							/>
							<Input
								aria-label="Shoot start time"
								type="time"
								value={shoot.startTime ?? ""}
								onChange={(event) =>
									updateShoot(index, {
										startTime: event.target.value,
									})
								}
							/>
							<Input
								aria-label="Shoot end time"
								type="time"
								value={shoot.endTime ?? ""}
								onChange={(event) =>
									updateShoot(index, {
										endTime: event.target.value,
									})
								}
							/>
							<Input
								aria-label="Shoot venue"
								value={shoot.venue ?? ""}
								placeholder="Venue"
								onChange={(event) =>
									updateShoot(index, {
										venue: event.target.value,
									})
								}
							/>
							<Input
								aria-label="Shoot venue address"
								className="sm:col-span-2"
								value={shoot.venueAddress ?? ""}
								placeholder="Location"
								onChange={(event) =>
									updateShoot(index, {
										venueAddress: event.target.value,
									})
								}
							/>
							<Input
								aria-label="Required crew count"
								type="number"
								min="1"
								value={shoot.requiredCrewCount ?? ""}
								placeholder="Required crew"
								onChange={(event) =>
									updateShoot(index, {
										requiredCrewCount: event.target.value
											? Number(event.target.value)
											: undefined,
									})
								}
							/>
						</div>
						<Field>
							<FieldLabel>Additional services</FieldLabel>
							<MultiSelectCombobox
								options={serviceOptions}
								value={shoot.additionalServices ?? []}
								onValueChange={(additionalServices) =>
									updateShoot(index, { additionalServices })
								}
								placeholder="Select coverage services"
							/>
						</Field>
						<Textarea
							aria-label="Shoot notes"
							value={shoot.notes ?? ""}
							placeholder="Shoot notes"
							onChange={(event) =>
								updateShoot(index, {
									notes: event.target.value,
								})
							}
						/>
						<CrewAssignmentsEditor
							crews={crews}
							assignments={(shoot.crewAssignments ?? []).map(
								(item) => ({
									crewId: item.crewId,
									rate: item.rate,
									role: item.role,
									isLead: item.isLead,
								}),
							)}
							showRate
							showRole
							onChange={(crewAssignments) =>
								updateShoot(index, { crewAssignments })
							}
						/>
					</OperationCard>
				))}
			</FieldGroup>
		</OperationSection>
	);
}
