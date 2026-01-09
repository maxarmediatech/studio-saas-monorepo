"use client";

import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { cn } from "@repo/ui/lib/utils";
import { PencilIcon, StickyNoteIcon } from "lucide-react";

interface BookingNoteCardProps {
	note: string | null;
	onEdit?: () => void;
	className?: string;
}

/**
 * Displays booking notes in an amber-tinted card (like order notes in e-commerce)
 * Shows empty state with prompt to add a note if none exists
 */
export function BookingNoteCard({
	note,
	onEdit,
	className,
}: BookingNoteCardProps) {
	const hasNote = note && note.trim().length > 0;

	return (
		<Card
			className={cn(
				"border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20",
				className,
			)}
		>
			<CardContent className="p-4">
				<div className="flex items-start justify-between gap-2">
					<div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-200">
						<StickyNoteIcon className="h-4 w-4" />
						<span>Booking Note</span>
					</div>
					{onEdit && (
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6 text-amber-700 hover:bg-amber-100 hover:text-amber-900 dark:text-amber-300 dark:hover:bg-amber-900/50"
							onClick={onEdit}
							aria-label="Edit note"
						>
							<PencilIcon className="h-3 w-3" />
						</Button>
					)}
				</div>
				{hasNote ? (
					<p className="mt-2 text-sm text-amber-900/80 dark:text-amber-100/80">
						{note}
					</p>
				) : (
					<button
						type="button"
						onClick={onEdit}
						className="mt-2 text-sm text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
					>
						Add a note about this booking...
					</button>
				)}
			</CardContent>
		</Card>
	);
}
