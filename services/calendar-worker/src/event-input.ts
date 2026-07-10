import {
	and,
	bookings,
	crews,
	db,
	eq,
	isNull,
	organizations,
	shootAssignments,
	shoots,
} from "@repo/database";
import { buildShootAllDayEventInput } from "@repo/google-calendar";

export async function buildEventInput(params: {
	organizationId: string;
	shootId: string;
	crewId: string;
	allowMissingAssignment?: boolean;
}) {
	const shoot = await db.query.shoots.findFirst({
		where: and(
			eq(shoots.id, params.shootId),
			eq(shoots.organizationId, params.organizationId),
		),
	});
	if (!shoot) {
		throw new Error("Shoot not found in calendar job organization");
	}
	if (
		!params.allowMissingAssignment &&
		(shoot.deletedAt || ["cancelled", "completed"].includes(shoot.status))
	) {
		throw new Error("Active shoot not found for calendar delivery");
	}

	const [crew, booking, assignment, organization] = await Promise.all([
		db.query.crews.findFirst({
			where: and(
				eq(crews.id, params.crewId),
				eq(crews.organizationId, params.organizationId),
				isNull(crews.deletedAt),
			),
			columns: { name: true, email: true },
		}),
		db.query.bookings.findFirst({
			where: and(
				eq(bookings.id, shoot.bookingId),
				eq(bookings.organizationId, params.organizationId),
			),
			columns: { name: true, referenceNumber: true },
		}),
		db.query.shootAssignments.findFirst({
			where: and(
				eq(shootAssignments.shootId, params.shootId),
				eq(shootAssignments.crewId, params.crewId),
			),
			columns: { role: true },
		}),
		db.query.organizations.findFirst({
			where: eq(organizations.id, params.organizationId),
			columns: { slug: true, timezone: true },
		}),
	]);

	if (!crew) {
		throw new Error("Crew not found in calendar job organization");
	}
	if (!booking) {
		throw new Error("Booking not found in calendar job organization");
	}
	if (!assignment && !params.allowMissingAssignment) {
		throw new Error("Active shoot assignment not found");
	}
	if (!organization) {
		throw new Error("Calendar job organization not found");
	}

	const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
	const shootUrl = organization.slug
		? `${baseUrl}/app/${organization.slug}/shoots/${shoot.id}`
		: null;

	return {
		crew,
		shoot,
		input: buildShootAllDayEventInput({
			shootName: shoot.name,
			shootType: shoot.shootType,
			shootDate: normalizeYmd(shoot.shootDate),
			startTime: shoot.startTime ? String(shoot.startTime) : null,
			endTime: shoot.endTime ? String(shoot.endTime) : null,
			venue: shoot.venue,
			venueAddress: shoot.venueAddress,
			notes: shoot.notes,
			bookingName: booking.name,
			bookingReferenceNumber: booking.referenceNumber,
			crewName: crew.name,
			crewRole: assignment?.role ?? null,
			organizationTimezone: organization.timezone,
			shootUrl,
		}),
	};
}

function normalizeYmd(value: unknown): string {
	if (typeof value === "string") {
		return value.slice(0, 10);
	}
	if (value instanceof Date) {
		const yyyy = value.getUTCFullYear();
		const mm = String(value.getUTCMonth() + 1).padStart(2, "0");
		const dd = String(value.getUTCDate()).padStart(2, "0");
		return `${yyyy}-${mm}-${dd}`;
	}
	throw new Error("Invalid shootDate type");
}
