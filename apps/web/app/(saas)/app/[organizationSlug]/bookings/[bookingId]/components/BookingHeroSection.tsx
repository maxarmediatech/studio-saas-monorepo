"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { format, parseISO } from "date-fns";
import { CalendarIcon, MapPinIcon } from "lucide-react";
import {
	formatPackageType,
	getPriorityVariant,
	getStatusVariant,
} from "./utils";

type BookingHeroSectionProps = {
	booking: {
		referenceNumber?: string;
		name: string;
		status: string;
		statusLabel?: string;
		priority?: string;
		bookingType?: string | null;
		packageType?: string | null;
		eventDate?: string | Date | null;
		eventTime?: string | null;
		venue?: string | null;
		city?: string | null;
	};
	onMessageClients?: () => void;
	onShareBrief?: () => void;
	onAddTask?: () => void;
};

export function BookingHeroSection({
	booking,
	onMessageClients,
	onShareBrief,
	onAddTask,
}: BookingHeroSectionProps) {
	const statusLabel =
		booking.statusLabel || booking.status.replace("_", " ");
	const priority = booking.priority || "medium";

	const eventDateFormatted = booking.eventDate
		? format(
				typeof booking.eventDate === "string"
					? parseISO(booking.eventDate)
					: booking.eventDate,
				"MMM d, yyyy",
			)
		: null;

	const locationStr = [booking.venue, booking.city]
		.filter(Boolean)
		.join(", ");

	const hasActions = onMessageClients || onShareBrief || onAddTask;

	return (
		<section className="rounded-lg border bg-background p-6">
			<div className="flex flex-wrap items-start justify-between gap-4">
				{/* Left: Badges + Title + Meta */}
				<div className="space-y-3">
					{/* Badges */}
					<div className="flex flex-wrap items-center gap-2">
						<Badge
							variant={getStatusVariant(booking.status)}
							className="capitalize"
						>
							{statusLabel}
						</Badge>
						<Badge
							variant={getPriorityVariant(priority)}
							className="capitalize"
						>
							{priority}
						</Badge>
						{booking.bookingType && (
							<Badge variant="outline" className="capitalize">
								{formatPackageType(booking.bookingType)}
							</Badge>
						)}
					</div>

					{/* Title and Package */}
					<div>
						<h2 className="text-2xl font-semibold">{booking.name}</h2>
						{booking.packageType && (
							<p className="text-sm text-muted-foreground">
								{formatPackageType(booking.packageType)} package
							</p>
						)}
					</div>

					{/* Meta info */}
					<div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
						{booking.referenceNumber && (
							<span>Ref {booking.referenceNumber}</span>
						)}
						{locationStr && (
							<span className="flex items-center gap-1">
								<MapPinIcon className="h-3.5 w-3.5" />
								{locationStr}
							</span>
						)}
						{eventDateFormatted && (
							<span className="flex items-center gap-1">
								<CalendarIcon className="h-3.5 w-3.5" />
								{eventDateFormatted}
								{booking.eventTime && ` - ${booking.eventTime}`}
							</span>
						)}
					</div>
				</div>

				{/* Right: Action buttons */}
				{hasActions && (
					<div className="flex flex-wrap items-center gap-2">
						{onMessageClients && (
							<Button size="sm" onClick={onMessageClients}>
								Message clients
							</Button>
						)}
						{onShareBrief && (
							<Button size="sm" variant="outline" onClick={onShareBrief}>
								Share brief
							</Button>
						)}
						{onAddTask && (
							<Button size="sm" variant="outline" onClick={onAddTask}>
								Add task
							</Button>
						)}
					</div>
				)}
			</div>
		</section>
	);
}
