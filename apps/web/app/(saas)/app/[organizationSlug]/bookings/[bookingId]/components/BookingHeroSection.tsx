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
		createdAt?: string | Date | null;
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

	const bookedOnFormatted = booking.createdAt
		? format(
				typeof booking.createdAt === "string"
					? parseISO(booking.createdAt)
					: booking.createdAt,
				"MMM d, yyyy",
			)
		: null;

	const locationStr = [booking.venue, booking.city]
		.filter(Boolean)
		.join(", ");

	// Build subtitle: "{Package} package - {BookingType} coverage" or just one if the other is missing
	const subtitleParts: string[] = [];
	if (booking.packageType) {
		subtitleParts.push(`${formatPackageType(booking.packageType)} package`);
	}
	if (booking.bookingType) {
		subtitleParts.push(`${formatPackageType(booking.bookingType)} coverage`);
	}
	const subtitle = subtitleParts.join(" - ");

	const hasActions = onMessageClients || onShareBrief || onAddTask;

	return (
		<section className="rounded-lg border bg-background p-6">
			<div className="space-y-4">
				{/* Badges + Booked on */}
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
					{bookedOnFormatted && (
						<span className="text-xs text-muted-foreground">
							Booked on {bookedOnFormatted}
						</span>
					)}
				</div>

				{/* Title and Package/Type */}
				<div>
					<h2 className="text-2xl font-semibold">{booking.name}</h2>
					{subtitle && (
						<p className="text-sm text-muted-foreground">{subtitle}</p>
					)}
				</div>

				{/* Meta info */}
				<div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
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

				{/* Action buttons at bottom */}
				{hasActions && (
					<div className="flex flex-wrap items-center gap-2 pt-2">
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
