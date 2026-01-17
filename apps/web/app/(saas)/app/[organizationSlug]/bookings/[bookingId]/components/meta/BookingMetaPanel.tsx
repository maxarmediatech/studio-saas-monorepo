"use client";

import { format, parseISO } from "date-fns";
import { BookingSignalsCard } from "./BookingSignalsCard";
import { ClientsCard } from "./ClientsCard";
import { NotesCard } from "./NotesCard";
import { QuickLinksCard } from "./QuickLinksCard";

type Participant = {
	client?: {
		id: string;
		name: string;
		email?: string | null;
		phone?: string | null;
	} | null;
};

type BookingMetaPanelProps = {
	booking: {
		createdAt?: string | Date | null;
		leadSource?: string | null;
		coordinator?: string | null;
		participants?: Participant[];
		note?: string | null;
	};
};

export function BookingMetaPanel({ booking }: BookingMetaPanelProps) {
	// Extract clients from participants
	const clients = (booking.participants ?? [])
		.map((p) => p.client)
		.filter((c): c is NonNullable<typeof c> => c !== null && c !== undefined);

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
			<NotesCard note={booking.note} />
			<ClientsCard clients={clients} />
			<QuickLinksCard />
			<BookingSignalsCard
				leadSource={booking.leadSource}
				coordinator={booking.coordinator}
				contractDate={contractDate}
			/>
		</aside>
	);
}
