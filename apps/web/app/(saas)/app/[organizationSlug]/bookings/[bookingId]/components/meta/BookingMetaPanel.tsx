"use client";

import { AttachmentsCard } from "./AttachmentsCard";
import { ClientsCard } from "./ClientsCard";
import { CrewsCard } from "./CrewsCard";
import { NotesCard } from "./NotesCard";

type Participant = {
	client?: {
		id: string;
		name: string;
		email?: string | null;
		phone?: string | null;
	} | null;
};

type Attachment = {
	name: string;
	size: number;
	type: string;
	url: string;
};

type BookingMetaPanelProps = {
	bookingId: string;
	booking: {
		participants?: Participant[];
		note?: string | null;
		contractAttachment?: Attachment | null;
	};
};

export function BookingMetaPanel({ bookingId, booking }: BookingMetaPanelProps) {
	// Extract clients from participants
	const clients = (booking.participants ?? [])
		.map((p) => p.client)
		.filter((c): c is NonNullable<typeof c> => c !== null && c !== undefined);

	return (
		<aside className="hidden lg:block space-y-6">
			<NotesCard note={booking.note} />
			<ClientsCard clients={clients} />
			<AttachmentsCard contractAttachment={booking.contractAttachment} />
			<CrewsCard bookingId={bookingId} />
		</aside>
	);
}
