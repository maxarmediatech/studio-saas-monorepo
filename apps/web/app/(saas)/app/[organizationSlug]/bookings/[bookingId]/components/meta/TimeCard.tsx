"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { Progress } from "@repo/ui/components/progress";
import { differenceInDays, format, parseISO } from "date-fns";

type TimeCardProps = {
	eventDate?: string | Date | null;
	bookingDate?: string | Date | null;
};

export function TimeCard({ eventDate, bookingDate }: TimeCardProps) {
	const eventDateParsed = eventDate
		? typeof eventDate === "string"
			? parseISO(eventDate)
			: eventDate
		: null;

	const bookingDateParsed = bookingDate
		? typeof bookingDate === "string"
			? parseISO(bookingDate)
			: bookingDate
		: null;

	const today = new Date();
	const daysRemaining = eventDateParsed
		? Math.max(0, differenceInDays(eventDateParsed, today))
		: null;

	const totalDays =
		eventDateParsed && bookingDateParsed
			? differenceInDays(eventDateParsed, bookingDateParsed)
			: null;

	const daysElapsed =
		bookingDateParsed && totalDays
			? Math.min(totalDays, differenceInDays(today, bookingDateParsed))
			: null;

	const progress =
		totalDays && totalDays > 0 && daysElapsed !== null
			? Math.round((daysElapsed / totalDays) * 100)
			: 0;

	const eventDateFormatted = eventDateParsed
		? format(eventDateParsed, "MMM d, yyyy")
		: "Not set";

	const estimate =
		totalDays !== null
			? totalDays > 30
				? `${Math.round(totalDays / 30)} months`
				: `${totalDays} days`
			: "—";

	return (
		<Card className="rounded-lg">
			<CardHeader>
				<CardTitle className="text-base">Time</CardTitle>
				<CardDescription>Key dates and remaining runway.</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3 text-sm">
				<div className="flex items-center justify-between">
					<span className="text-muted-foreground">Estimate</span>
					<span className="font-medium">{estimate}</span>
				</div>
				<div className="flex items-center justify-between">
					<span className="text-muted-foreground">Event date</span>
					<span className="font-medium">{eventDateFormatted}</span>
				</div>
				{daysRemaining !== null && (
					<div className="space-y-2">
						<div className="flex items-center justify-between text-xs text-muted-foreground">
							<span>Days remaining</span>
							<span>
								{daysRemaining === 0
									? "Today!"
									: `${daysRemaining} days to go`}
							</span>
						</div>
						<Progress value={progress} />
					</div>
				)}
			</CardContent>
		</Card>
	);
}
