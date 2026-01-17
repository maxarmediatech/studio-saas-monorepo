"use client";

import { format, parseISO } from "date-fns";
import { BacklogCard } from "./BacklogCard";
import { BookingSignalsCard } from "./BookingSignalsCard";
import { QuickLinksCard } from "./QuickLinksCard";
import { TimeCard } from "./TimeCard";

type Participant = {
	client?: { id: string; name: string; email?: string | null } | null;
};

type BookingMetaPanelProps = {
	booking: {
		status: string;
		bookingType?: string | null;
		packageType?: string | null;
		priority?: string;
		eventDate?: string | Date | null;
		createdAt?: string | Date | null;
		leadSource?: string | null;
		coordinator?: string | null;
		participants?: Participant[];
	};
};

export function BookingMetaPanel({ booking }: BookingMetaPanelProps) {
	// Derive PIC from first participant (if available)
	const pic = booking.participants?.[0]?.client
		? { name: booking.participants[0].client.name }
		: null;

	// Derive support from second participant (if available)
	const support = booking.participants?.[1]?.client
		? { name: booking.participants[1].client.name }
		: null;

	// Format contract date from createdAt
	const contractDate = booking.createdAt
		? format(
				typeof booking.createdAt === "string"
					? parseISO(booking.createdAt)
					: booking.createdAt,
				"MMM d, yyyy",
			)
		: null;

	return (
		<aside className="hidden lg:block space-y-6">
			<TimeCard
				eventDate={booking.eventDate}
				bookingDate={booking.createdAt}
			/>
			<BacklogCard
				status={booking.status}
				bookingType={booking.bookingType}
				packageType={booking.packageType}
				priority={booking.priority}
				pic={pic}
				support={support}
			/>
			<QuickLinksCard />
			<BookingSignalsCard
				leadSource={booking.leadSource}
				coordinator={booking.coordinator}
				contractDate={contractDate}
			/>
		</aside>
	);
}
