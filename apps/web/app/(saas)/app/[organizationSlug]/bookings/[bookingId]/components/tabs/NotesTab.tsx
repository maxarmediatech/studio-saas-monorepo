"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { FileTextIcon } from "lucide-react";

interface NotesTabProps {
	bookingId: string;
	note?: string | null;
}

type NoteItem = {
	title: string;
	meta: string;
	body: string;
};

// Parse notes from booking.note field or use defaults
function parseNotes(note: string | null | undefined): NoteItem[] {
	if (!note) {
		return [];
	}

	// Simple parsing: treat the entire note as a single note
	// In future, could parse structured notes from the field
	return [
		{
			title: "Booking notes",
			meta: "From booking",
			body: note,
		},
	];
}

function NoteCard({ note }: { note: NoteItem }) {
	return (
		<div className="rounded-lg border bg-muted/10 px-4 py-3">
			<div className="flex items-center justify-between">
				<p className="text-sm font-medium">{note.title}</p>
				<span className="text-xs text-muted-foreground">{note.meta}</span>
			</div>
			<p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
				{note.body}
			</p>
		</div>
	);
}

function EmptyNotes() {
	return (
		<div className="flex flex-col items-center gap-2 py-12 text-center">
			<FileTextIcon className="h-8 w-8 text-muted-foreground/30" />
			<p className="text-sm text-muted-foreground">
				No notes added to this booking yet.
			</p>
		</div>
	);
}

export function NotesTab({ bookingId: _bookingId, note }: NotesTabProps) {
	const notes = parseNotes(note);

	return (
		<div className="space-y-6">
			<Card className="shadow-none rounded-lg">
				<CardHeader>
					<CardTitle className="text-base">Notes and guidance</CardTitle>
					<CardDescription>
						Preferences and special callouts.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{notes.length === 0 ? (
						<EmptyNotes />
					) : (
						<div className="space-y-4">
							{notes.map((n) => (
								<NoteCard key={n.title} note={n} />
							))}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
