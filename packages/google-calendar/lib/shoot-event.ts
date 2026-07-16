import type { GoogleAllDayEventInput } from "./calendar";

export interface ShootCalendarEventContext {
	shootName: string;
	shootType: string;
	shootDate: string; // YYYY-MM-DD
	startTime?: string | null;
	endTime?: string | null;
	venue?: string | null;
	venueAddress?: string | null;
	notes?: string | null;
	bookingName?: string | null;
	bookingReferenceNumber?: string | null;
	crewName?: string | null;
	crewRole?: string | null;
	organizationTimezone?: string | null;
	shootUrl?: string | null;
}

export function buildShootAllDayEventInput(
	ctx: ShootCalendarEventContext,
): GoogleAllDayEventInput {
	const title = buildShootEventTitle(ctx);

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
		descriptionLines.push(
			`Call time: ${ctx.startTime}${ctx.endTime ? ` – ${ctx.endTime}` : ""}`,
		);
		if (ctx.organizationTimezone) {
			descriptionLines.push(`Time zone: ${ctx.organizationTimezone}`);
		}
	}
	if (ctx.crewName) {
		descriptionLines.push(`Crew: ${ctx.crewName}`);
	}
	if (ctx.crewRole && !isGenericCrewRole(ctx.crewRole)) {
		descriptionLines.push(`Role: ${ctx.crewRole}`);
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

function buildShootEventTitle(ctx: ShootCalendarEventContext): string {
	const bookingName = normalizeTitlePart(ctx.bookingName);
	const shootType = normalizeTitlePart(ctx.shootType);
	const shootName = normalizeTitlePart(ctx.shootName);

	const titleParts: string[] = [];

	if (bookingName) {
		titleParts.push(bookingName);
	}

	if (shootType) {
		titleParts.push(shootType);
	}

	if (
		shootName &&
		(!shootType ||
			!equalsIgnoreCaseAndSpaceInsensitive(shootName, shootType))
	) {
		titleParts.push(shootName);
	}

	if (titleParts.length > 0) {
		return titleParts.join(" — ");
	}

	return "Shoot";
}

function normalizeTitlePart(value: string | null | undefined): string | null {
	const trimmed = value?.trim();
	return trimmed && trimmed.length > 0 ? trimmed : null;
}

function equalsIgnoreCaseAndSpaceInsensitive(a: string, b: string): boolean {
	return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function isGenericCrewRole(role: string): boolean {
	return role.trim().toLowerCase() === "crew";
}
