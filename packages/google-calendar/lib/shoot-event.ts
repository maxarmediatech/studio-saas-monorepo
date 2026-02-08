import type { GoogleAllDayEventInput } from "./calendar";

export interface ShootCalendarEventContext {
	shootName: string;
	shootType: string;
	shootDate: string; // YYYY-MM-DD
	startTime?: string | null;
	venue?: string | null;
	venueAddress?: string | null;
	notes?: string | null;
	bookingName?: string | null;
	bookingReferenceNumber?: string | null;
	crewName?: string | null;
	crewRole?: string | null;
	shootUrl?: string | null;
}

export function buildShootAllDayEventInput(
	ctx: ShootCalendarEventContext,
): GoogleAllDayEventInput {
	const titleParts = [ctx.shootName, ctx.crewRole].filter(Boolean);
	const title = titleParts.join(" — ") || ctx.shootName;

	const location = [ctx.venue, ctx.venueAddress].filter(Boolean).join("\n");

	const descriptionLines: string[] = [];
	if (ctx.bookingReferenceNumber || ctx.bookingName) {
		descriptionLines.push(
			`Booking: ${[ctx.bookingReferenceNumber, ctx.bookingName]
				.filter(Boolean)
				.join(" — ")}`,
		);
	}
	if (ctx.shootType) {
		descriptionLines.push(`Shoot type: ${ctx.shootType}`);
	}
	if (ctx.startTime) {
		descriptionLines.push(`Call time: ${ctx.startTime}`);
	}
	if (ctx.crewName) {
		descriptionLines.push(`Crew: ${ctx.crewName}`);
	}
	if (ctx.notes) {
		descriptionLines.push("", "Notes:", ctx.notes);
	}
	if (ctx.shootUrl) {
		descriptionLines.push("", `Open in Studio SaaS: ${ctx.shootUrl}`);
	}

	return {
		title,
		date: ctx.shootDate,
		location: location || null,
		description: descriptionLines
			.filter((l) => l.trim().length > 0)
			.join("\n"),
	};
}
