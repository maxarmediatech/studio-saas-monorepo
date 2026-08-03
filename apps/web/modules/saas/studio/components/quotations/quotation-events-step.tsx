"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Combobox, type ComboboxOption } from "@repo/ui/components/combobox";
import { DatePicker } from "@repo/ui/components/date-picker";
import { Input } from "@repo/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Textarea } from "@repo/ui/components/textarea";
import { useConfigurationParams } from "@saas/studio/hooks/params/use-configuration-params";
import { useQuery } from "@tanstack/react-query";
import {
	CalendarDaysIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	PlusIcon,
	Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { bookingFormQueries } from "../bookings/booking-form/booking-form-queries";
import { configurationControlMode } from "../configurations/apply-package-configuration";
import type { EventSide, QuotationEvent } from "./quotation-wizard-data";
import { FieldBlock, sideLabels } from "./quotation-wizard-parts";

const EVENT_SIDES: EventSide[] = [
	"common",
	"bride",
	"groom",
	"both",
	"separateCommon",
];

export function EventsStep({
	events,
	onAdd,
	onRemove,
	onUpdate,
	errors,
}: {
	events: QuotationEvent[];
	onAdd: () => void;
	onRemove: (id: string) => void;
	onUpdate: (id: string, patch: Partial<QuotationEvent>) => void;
	errors: Record<string, string>;
}) {
	const eventTypesQuery = useQuery(bookingFormQueries.eventTypes());
	const { data: eventTypesData, isPending: eventTypesLoading } =
		eventTypesQuery;
	const eventTypeOptions: ComboboxOption[] =
		eventTypesData?.data.map((eventType) => ({
			value: eventType.label,
			label: eventType.label,
		})) ?? [];
	const eventTypeControlMode = configurationControlMode({
		isPending: eventTypesLoading,
		isError: eventTypesQuery.isError,
		optionCount: eventTypeOptions.length,
	});

	return (
		<div className="space-y-4">
			<h2 className="text-lg font-semibold">Function Details</h2>
			<Card>
				<CardContent className="space-y-6">
					<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
						{EVENT_SIDES.map((side) => (
							<div key={side} className="rounded-md border p-3">
								<p className="text-xs text-muted-foreground">
									{sideLabels[side]}
								</p>
								<p className="mt-1 text-2xl font-semibold">
									{
										events.filter(
											(event) => event.side === side,
										).length
									}
								</p>
							</div>
						))}
					</div>
					<div className="space-y-3 border-t pt-6">
						{events.length === 0 ? (
							<div className="flex items-center gap-3 rounded-lg border border-dashed px-4 py-6">
								<CalendarDaysIcon className="h-8 w-8 shrink-0 text-muted-foreground/50" />
								<div className="text-left">
									<p className="text-sm text-muted-foreground">
										No events added yet
									</p>
									<Button
										type="button"
										variant="link"
										size="sm"
										className="h-auto p-0"
										onClick={onAdd}
									>
										Add first event
									</Button>
								</div>
							</div>
						) : (
							events.map((event, index) => (
								<EventSection
									key={event.id}
									event={event}
									index={index}
									eventTypeOptions={eventTypeOptions}
									eventTypes={eventTypesData?.data ?? []}
									eventTypesLoading={eventTypesLoading}
									eventTypeControlMode={eventTypeControlMode}
									errors={errors}
									onRetryEventTypes={() =>
										eventTypesQuery.refetch()
									}
									onRemove={() => onRemove(event.id)}
									onUpdate={(patch) =>
										onUpdate(event.id, patch)
									}
								/>
							))
						)}
					</div>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="w-full justify-center border-dashed"
						onClick={onAdd}
					>
						<PlusIcon className="mr-2 h-4 w-4" />
						Add another event
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}

function EventSection({
	event,
	index,
	eventTypeOptions,
	eventTypes,
	eventTypesLoading,
	eventTypeControlMode,
	errors,
	onRetryEventTypes,
	onRemove,
	onUpdate,
}: {
	event: QuotationEvent;
	index: number;
	eventTypeOptions: ComboboxOption[];
	eventTypes: Array<{ id: string; key: string; label: string }>;
	eventTypesLoading: boolean;
	eventTypeControlMode: "loading" | "error" | "configured" | "freeText";
	errors: Record<string, string>;
	onRetryEventTypes: () => void;
	onRemove: () => void;
	onUpdate: (patch: Partial<QuotationEvent>) => void;
}) {
	const [showNotes, setShowNotes] = useState(Boolean(event.notes));
	const { openCreate } = useConfigurationParams();

	return (
		<div className="overflow-hidden rounded-lg border bg-muted/10">
			<div className="flex items-center justify-between gap-2 border-b bg-muted/20 px-4 py-3">
				<div className="flex items-center gap-2">
					<CalendarDaysIcon className="h-4 w-4 text-muted-foreground" />
					<span className="text-sm font-medium">
						Event {index + 1}
					</span>
					<Badge variant="outline" className="font-normal">
						{sideLabels[event.side]}
					</Badge>
				</div>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
					onClick={onRemove}
				>
					<Trash2Icon className="h-4 w-4" />
					<span className="sr-only">Remove event</span>
				</Button>
			</div>
			<div className="space-y-4 p-4">
				<div className="grid grid-cols-1 gap-3 md:grid-cols-4">
					<FieldBlock
						label="Event Type"
						className="md:col-span-2"
						error={errors[`quotation-event-${event.id}-name`]}
					>
						{eventTypeControlMode === "error" ? (
							<div className="flex gap-2">
								<Input
									disabled
									placeholder="Could not load event types"
								/>
								<Button
									type="button"
									variant="outline"
									onClick={onRetryEventTypes}
								>
									Retry
								</Button>
							</div>
						) : eventTypeControlMode !== "freeText" ? (
							<Combobox
								id={`quotation-event-${event.id}-name`}
								aria-invalid={Boolean(
									errors[`quotation-event-${event.id}-name`],
								)}
								value={event.name}
								onValueChange={(value) => {
									const selected = eventTypes.find(
										(item) => item.label === value,
									);
									onUpdate({
										name: value,
										eventTypeId: selected?.id ?? null,
										eventTypeKey: selected?.key ?? null,
									});
								}}
								options={eventTypeOptions}
								placeholder={
									eventTypesLoading
										? "Loading..."
										: "Select event type..."
								}
								searchPlaceholder="Search events..."
								emptyText="No matching event types"
								disabled={eventTypeControlMode === "loading"}
								onCreate={{
									label: "Add event type",
									onClick: () => openCreate("event_type"),
								}}
							/>
						) : (
							<Input
								id={`quotation-event-${event.id}-name`}
								aria-invalid={Boolean(
									errors[`quotation-event-${event.id}-name`],
								)}
								value={event.name}
								placeholder="e.g. Nirbandha, Haldi, Reception"
								onChange={(change) =>
									onUpdate({ name: change.target.value })
								}
							/>
						)}
					</FieldBlock>
					<FieldBlock label="Side">
						<Select
							value={event.side}
							onValueChange={(value) =>
								onUpdate({ side: value as EventSide })
							}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{EVENT_SIDES.map((side) => (
									<SelectItem key={side} value={side}>
										{sideLabels[side]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</FieldBlock>
					<FieldBlock label="Guest count">
						<Input
							value={event.guestCount}
							placeholder="Tentative"
							onChange={(change) =>
								onUpdate({ guestCount: change.target.value })
							}
						/>
					</FieldBlock>
				</div>
				<div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_1fr]">
					<FieldBlock label="Timeline">
						<Select
							value={event.tentative ? "tentative" : "fixed"}
							onValueChange={(value) =>
								onUpdate({
									tentative: value === "tentative",
									date: "",
								})
							}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="fixed">Fixed</SelectItem>
								<SelectItem value="tentative">
									Tentative
								</SelectItem>
							</SelectContent>
						</Select>
					</FieldBlock>
					<FieldBlock
						label={event.tentative ? "Date window" : "Date"}
						error={errors[`quotation-event-${event.id}-date`]}
					>
						{event.tentative ? (
							<Input
								id={`quotation-event-${event.id}-date`}
								aria-invalid={Boolean(
									errors[`quotation-event-${event.id}-date`],
								)}
								value={event.date}
								placeholder="e.g. Tentative Jan 2027"
								onChange={(change) =>
									onUpdate({ date: change.target.value })
								}
							/>
						) : (
							<DatePicker
								id={`quotation-event-${event.id}-date`}
								aria-invalid={Boolean(
									errors[`quotation-event-${event.id}-date`],
								)}
								value={event.date}
								onValueChange={(date) =>
									onUpdate({ date: date ?? "" })
								}
							/>
						)}
					</FieldBlock>
				</div>
				<FieldBlock label="Location">
					<Textarea
						value={event.location}
						placeholder="e.g. Grand Ballroom, Hotel Taj, Bhadrak"
						rows={2}
						onChange={(change) =>
							onUpdate({ location: change.target.value })
						}
					/>
				</FieldBlock>
				{(showNotes || event.notes) && (
					<FieldBlock label="Notes">
						<Textarea
							value={event.notes}
							placeholder="Any special context for this event"
							rows={2}
							onChange={(change) =>
								onUpdate({ notes: change.target.value })
							}
						/>
						{showNotes && !event.notes && (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="mt-1 h-auto px-1 py-0 text-muted-foreground"
								onClick={() => setShowNotes(false)}
							>
								<ChevronUpIcon className="mr-1 h-3.5 w-3.5" />
								Hide
							</Button>
						)}
					</FieldBlock>
				)}
				{!showNotes && !event.notes && (
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
			</div>
		</div>
	);
}
