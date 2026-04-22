"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { format, parseISO } from "date-fns";
import {
	AlertCircleIcon,
	CalendarIcon,
	MapPinIcon,
	PencilIcon,
	PhoneIcon,
	PlusIcon,
} from "lucide-react";
import {
	formatPackageType,
	getPriorityVariant,
	getStatusVariant,
} from "./utils";

type Participant = {
	client?: {
		id: string;
		name: string;
		email?: string | null;
		phone?: string | null;
	} | null;
};

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
		bookingDate?: string | Date | null;
		createdAt?: string | Date | null;
		participants?: Participant[];
	};
	onEdit?: () => void;
	onAddShoot?: () => void;
	onAddDeliverable?: () => void;
	onAddTask?: () => void;
	onAddPayment?: () => void;
	onAddExpense?: () => void;
};

export function BookingHeroSection({
	booking,
	onEdit,
	onAddShoot,
	onAddDeliverable,
	onAddTask,
	onAddPayment,
	onAddExpense,
}: BookingHeroSectionProps) {
	const statusLabel = booking.statusLabel || booking.status.replace("_", " ");
	const priority = booking.priority || "medium";

	const eventDateFormatted = booking.eventDate
		? format(
				typeof booking.eventDate === "string"
					? parseISO(booking.eventDate)
					: booking.eventDate,
				"MMM d, yyyy",
			)
		: null;

	const bookedOnFormatted = booking.bookingDate
		? format(
				typeof booking.bookingDate === "string"
					? parseISO(booking.bookingDate)
					: booking.bookingDate,
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
		subtitleParts.push(
			`${formatPackageType(booking.bookingType)} coverage`,
		);
	}
	const subtitle = subtitleParts.join(" - ");

	const hasActions =
		onAddShoot ||
		onAddDeliverable ||
		onAddTask ||
		onAddPayment ||
		onAddExpense;

	// Get client contact info for phone tags
	const clients =
		booking.participants
			?.map((p) => p.client)
			.filter((c): c is NonNullable<typeof c> => c != null) ?? [];
	const clientsWithPhone = clients.filter((c) => c.phone);
	const clientsWithoutPhone = clients.filter((c) => !c.phone);

	return (
		<section className="rounded-lg border bg-background p-6">
			<div className="space-y-4">
				{/* Top row: Badges + Edit button */}
				<div className="flex items-start justify-between gap-4">
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

					{/* Edit button */}
					{onEdit && (
						<Button variant="outline" size="sm" onClick={onEdit}>
							<PencilIcon className="h-4 w-4 mr-1.5" />
							Edit
						</Button>
					)}
				</div>

				{/* Title and Package/Type */}
				<div>
					<h2 className="text-2xl font-semibold">{booking.name}</h2>
					{subtitle && (
						<p className="text-sm text-muted-foreground">
							{subtitle}
						</p>
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

				{/* Client phone tags */}
				{clients.length > 0 && (
					<div className="flex flex-wrap gap-2">
						{clientsWithPhone.map((client) => (
							<Badge key={client.id} variant="secondary" asChild>
								<a
									href={`tel:${client.phone}`}
									className="gap-1.5"
								>
									<PhoneIcon className="h-3 w-3" />
									{client.phone}
								</a>
							</Badge>
						))}
						{clientsWithoutPhone.map((client) => (
							<Badge
								key={client.id}
								variant="outline"
								className="gap-1.5 border-amber-200 bg-amber-50 text-amber-700"
							>
								<AlertCircleIcon className="h-3 w-3" />
								{client.name} - No phone
							</Badge>
						))}
					</div>
				)}

				{/* Action buttons at bottom */}
				{hasActions && (
					<div className="flex flex-wrap items-center gap-2 pt-2">
						{onAddShoot && (
							<Button size="sm" onClick={onAddShoot}>
								<PlusIcon className="h-3.5 w-3.5 mr-1.5" />
								Add shoot
							</Button>
						)}
						{onAddDeliverable && (
							<Button
								size="sm"
								variant="outline"
								onClick={onAddDeliverable}
							>
								<PlusIcon className="h-3.5 w-3.5 mr-1.5" />
								Add deliverable
							</Button>
						)}
						{onAddTask && (
							<Button
								size="sm"
								variant="outline"
								onClick={onAddTask}
							>
								<PlusIcon className="h-3.5 w-3.5 mr-1.5" />
								Add task
							</Button>
						)}
						{onAddPayment && (
							<Button
								size="sm"
								variant="outline"
								onClick={onAddPayment}
							>
								<PlusIcon className="h-3.5 w-3.5 mr-1.5" />
								Add payment
							</Button>
						)}
						{onAddExpense && (
							<Button
								size="sm"
								variant="outline"
								onClick={onAddExpense}
							>
								<PlusIcon className="h-3.5 w-3.5 mr-1.5" />
								Add expense
							</Button>
						)}
					</div>
				)}
			</div>
		</section>
	);
}
