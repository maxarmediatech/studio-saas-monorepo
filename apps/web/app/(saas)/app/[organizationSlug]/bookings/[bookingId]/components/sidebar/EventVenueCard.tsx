"use client";

import { Card, CardContent } from "@repo/ui/components/card";
import { cn } from "@repo/ui/lib/utils";
import { CalendarIcon, MapPinIcon } from "lucide-react";
import { format } from "date-fns";

interface Event {
	eventType: string;
	eventDate: Date | string;
	venue: string | null;
	venueAddress?: string | null;
}

interface EventVenueCardProps {
	events: Event[];
	className?: string;
}

/**
 * Displays event venue information
 * Shows first event prominently, lists additional events below
 */
export function EventVenueCard({ events, className }: EventVenueCardProps) {
	if (events.length === 0) {
		return (
			<Card className={cn("shadow-none", className)}>
				<CardContent className="p-4">
					<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
						<MapPinIcon className="h-4 w-4" />
						<span>Event Venue</span>
					</div>
					<p className="mt-2 text-sm text-muted-foreground">
						No events scheduled
					</p>
				</CardContent>
			</Card>
		);
	}

	const primaryEvent = events[0];
	const additionalEvents = events.slice(1);

	const formatEventDate = (date: Date | string) => {
		if (!date) return "-";
		return format(new Date(date), "MMM d, yyyy");
	};

	return (
		<Card className={cn("shadow-none", className)}>
			<CardContent className="p-4">
				<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
					<MapPinIcon className="h-4 w-4" />
					<span>Event Venue</span>
				</div>

				{/* Primary event */}
				<div className="mt-3 space-y-2">
					<div className="flex items-center gap-2">
						<span className="font-medium">{primaryEvent.eventType}</span>
					</div>

					<div className="flex items-center gap-1.5 text-sm text-muted-foreground">
						<CalendarIcon className="h-3.5 w-3.5" />
						<span>{formatEventDate(primaryEvent.eventDate)}</span>
					</div>

					{primaryEvent.venue && (
						<div className="text-sm">
							<p className="font-medium">{primaryEvent.venue}</p>
							{primaryEvent.venueAddress && (
								<p className="text-muted-foreground mt-0.5">
									{primaryEvent.venueAddress}
								</p>
							)}
						</div>
					)}
				</div>

				{/* Additional events */}
				{additionalEvents.length > 0 && (
					<div className="mt-4 pt-3 border-t space-y-3">
						{additionalEvents.map((event, index) => (
							<div
								key={`${event.eventType}-${event.eventDate}-${index}`}
								className="text-sm"
							>
								<div className="flex items-center justify-between">
									<span className="font-medium">{event.eventType}</span>
									<span className="text-muted-foreground">
										{formatEventDate(event.eventDate)}
									</span>
								</div>
								{event.venue && (
									<p className="text-muted-foreground mt-0.5">{event.venue}</p>
								)}
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
