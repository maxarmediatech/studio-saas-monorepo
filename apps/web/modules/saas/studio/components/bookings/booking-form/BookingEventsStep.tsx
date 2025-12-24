"use client";

import { useFieldArray, useFormContext } from "react-hook-form";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import {
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { CalendarIcon, PlusIcon, TrashIcon } from "lucide-react";
import type { BookingFormValues } from "./booking-form-schema";

// Common event types for photography
const EVENT_TYPE_OPTIONS = [
	{ value: "wedding", label: "Wedding" },
	{ value: "mehendi", label: "Mehendi" },
	{ value: "sangeet", label: "Sangeet" },
	{ value: "haldi", label: "Haldi" },
	{ value: "engagement", label: "Engagement" },
	{ value: "reception", label: "Reception" },
	{ value: "pre_wedding", label: "Pre-Wedding Shoot" },
	{ value: "other", label: "Other" },
];

export function BookingEventsStep() {
	const form = useFormContext<BookingFormValues>();

	const {
		fields: events,
		append: appendEvent,
		remove: removeEvent,
	} = useFieldArray({
		control: form.control,
		name: "events",
	});

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader className="flex flex-row items-center justify-between">
					<div>
						<CardTitle>Events</CardTitle>
						<p className="text-sm text-muted-foreground mt-1">
							Add events/dates for this booking (optional)
						</p>
					</div>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() =>
							appendEvent({
								eventType: "",
								eventDate: "",
								venue: "",
								venueAddress: "",
								notes: "",
							})
						}
					>
						<PlusIcon className="mr-2 h-4 w-4" />
						Add Event
					</Button>
				</CardHeader>
				<CardContent className="space-y-4">
					{events.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-8 text-center">
							<CalendarIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
							<p className="text-sm text-muted-foreground">
								No events added yet. Click "Add Event" to add wedding dates, shoot
								locations, etc.
							</p>
						</div>
					) : (
						events.map((field, index) => (
							<Card key={field.id} className="p-4">
								<div className="flex items-start gap-4">
									<div className="flex-1 space-y-4">
										<div className="grid gap-4 md:grid-cols-3">
											{/* Event Type */}
											<FormField
												control={form.control}
												name={`events.${index}.eventType`}
												render={({ field }) => (
													<FormItem>
														<FormLabel>Event Type</FormLabel>
														<FormControl>
															<Input
																{...field}
																placeholder="e.g. Wedding, Mehendi"
																list={`event-types-${index}`}
															/>
														</FormControl>
														<datalist id={`event-types-${index}`}>
															{EVENT_TYPE_OPTIONS.map((opt) => (
																<option key={opt.value} value={opt.label} />
															))}
														</datalist>
														<FormMessage />
													</FormItem>
												)}
											/>

											{/* Event Date */}
											<FormField
												control={form.control}
												name={`events.${index}.eventDate`}
												render={({ field }) => (
													<FormItem>
														<FormLabel>Event Date</FormLabel>
														<FormControl>
															<Input
																{...field}
																type="datetime-local"
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>

											{/* Venue */}
											<FormField
												control={form.control}
												name={`events.${index}.venue`}
												render={({ field }) => (
													<FormItem>
														<FormLabel>Venue</FormLabel>
														<FormControl>
															<Input
																{...field}
																placeholder="e.g. Grand Ballroom"
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
										</div>

										<div className="grid gap-4 md:grid-cols-2">
											{/* Venue Address */}
											<FormField
												control={form.control}
												name={`events.${index}.venueAddress`}
												render={({ field }) => (
													<FormItem>
														<FormLabel>Venue Address</FormLabel>
														<FormControl>
															<Input
																{...field}
																placeholder="Full address or Google Maps link"
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>

											{/* Notes */}
											<FormField
												control={form.control}
												name={`events.${index}.notes`}
												render={({ field }) => (
													<FormItem>
														<FormLabel>Notes</FormLabel>
														<FormControl>
															<Textarea
																{...field}
																placeholder="Any special instructions for this event"
																rows={1}
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
										</div>
									</div>

									{/* Remove Button */}
									<Button
										type="button"
										variant="ghost"
										size="icon"
										className="mt-8"
										onClick={() => removeEvent(index)}
									>
										<TrashIcon className="h-4 w-4 text-destructive" />
									</Button>
								</div>
							</Card>
						))
					)}
				</CardContent>
			</Card>
		</div>
	);
}
