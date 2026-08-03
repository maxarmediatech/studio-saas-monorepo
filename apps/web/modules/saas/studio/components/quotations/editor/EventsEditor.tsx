import { FieldGroup } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
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
import {
	dateTimeLocalToIso,
	isoToDateTimeLocal,
} from "../quotation-date-helpers";
import { OperationCard, OperationSection } from "./OperationSection";
import type { BookingDraft, ConfigurationOption } from "./types";

export function EventsEditor({
	booking,
	eventTypes,
	organizationTimezone,
	error,
	onChange,
}: {
	booking: BookingDraft;
	eventTypes: ConfigurationOption[];
	organizationTimezone: string;
	error?: string;
	onChange: (booking: BookingDraft) => void;
}) {
	const events = booking.events ?? [];
	const updateEvent = (
		index: number,
		value: Partial<(typeof events)[number]>,
	) =>
		onChange({
			...booking,
			events: events.map((item, itemIndex) =>
				itemIndex === index ? { ...item, ...value } : item,
			),
		});
	return (
		<OperationSection
			id="quotation-events"
			error={error}
			title="Events"
			description="Client event dates and venues copied into the booking."
			isEmpty={events.length === 0}
			onAdd={() =>
				onChange({
					...booking,
					events: [
						...events,
						{
							eventType: "",
							eventDate: new Date().toISOString(),
							venue: "",
							venueAddress: "",
							notes: "",
						},
					],
				})
			}
		>
			<FieldGroup className="gap-3">
				{events.map((event, index) => (
					<OperationCard
						key={index}
						onRemove={() =>
							onChange({
								...booking,
								events: events.filter(
									(_, itemIndex) => itemIndex !== index,
								),
							})
						}
					>
						<div className="grid gap-3 sm:grid-cols-2">
							<Select
								value={event.eventType || undefined}
								onValueChange={(eventType) =>
									updateEvent(index, { eventType })
								}
							>
								<SelectTrigger
									aria-label="Event type"
									className="w-full"
								>
									<SelectValue placeholder="Event type" />
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
								aria-label="Event date and time"
								type="datetime-local"
								value={isoToDateTimeLocal(
									event.eventDate,
									organizationTimezone,
								)}
								onChange={(changeEvent) =>
									updateEvent(index, {
										eventDate: dateTimeLocalToIso(
											changeEvent.target.value,
											organizationTimezone,
										),
									})
								}
							/>
							<Input
								aria-label="Event venue"
								value={event.venue ?? ""}
								placeholder="Venue"
								onChange={(changeEvent) =>
									updateEvent(index, {
										venue: changeEvent.target.value,
									})
								}
							/>
							<Input
								aria-label="Event venue address"
								value={event.venueAddress ?? ""}
								placeholder="Venue address"
								onChange={(changeEvent) =>
									updateEvent(index, {
										venueAddress: changeEvent.target.value,
									})
								}
							/>
						</div>
						<Textarea
							aria-label="Event notes"
							value={event.notes ?? ""}
							placeholder="Event notes"
							onChange={(changeEvent) =>
								updateEvent(index, {
									notes: changeEvent.target.value,
								})
							}
						/>
					</OperationCard>
				))}
			</FieldGroup>
		</OperationSection>
	);
}
