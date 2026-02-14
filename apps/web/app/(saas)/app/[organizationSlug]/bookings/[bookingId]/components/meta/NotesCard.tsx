"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { FileTextIcon } from "lucide-react";

type NotesCardProps = {
	note?: string | null;
};

function EmptyState() {
	return (
		<div className="flex flex-col items-center gap-2 py-6 text-center">
			<FileTextIcon className="h-6 w-6 text-muted-foreground/30" />
			<p className="text-xs text-muted-foreground">No notes yet</p>
		</div>
	);
}

export function NotesCard({ note }: NotesCardProps) {
	const hasNote = note && note.trim().length > 0;

	return (
		<Card className="rounded-lg">
			<CardHeader>
				<CardTitle className="text-base">Notes</CardTitle>
				<CardDescription>Preferences and special callouts.</CardDescription>
			</CardHeader>
			<CardContent>
				{hasNote ? (
					<div className="rounded-lg border bg-muted/10 px-3 py-2.5">
						<p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">
							{note}
						</p>
					</div>
				) : (
					<EmptyState />
				)}
			</CardContent>
		</Card>
	);
}
