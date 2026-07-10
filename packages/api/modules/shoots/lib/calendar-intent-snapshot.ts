import {
	and,
	bookings,
	crews,
	eq,
	isNull,
	organizations,
	shootAssignments,
	shoots,
} from "@repo/database";
import { buildShootAllDayEventInput } from "@repo/google-calendar";
import type { TransactionClient } from "../../studio/lib/transactions";
import type {
	CalendarSnapshot,
	DeliveryMethod,
	IntentState,
} from "./calendar-intents";

export type IntentTarget = {
	shootId: string;
	shootStatus: string;
	crewId: string;
	crewUserId: string | null;
	crewEmail: string | null;
	crewName: string;
	assignmentRole: string | null;
	shootName: string;
	shootType: string;
	shootDate: string | Date;
	startTime: string | null;
	endTime: string | null;
	venue: string | null;
	venueAddress: string | null;
	notes: string | null;
	bookingName: string;
	bookingReferenceNumber: string | null;
	organizationTimezone: string | null;
	organizationSlug: string | null;
};

export function getIcalUid(
	shootId: string,
	crewId: string,
	generation: number,
) {
	return `shoot-${shootId}-crew-${crewId}-g${generation}@studio-saas.invalid`;
}

export function sameMaterialSnapshot(
	left: CalendarSnapshot,
	right: CalendarSnapshot,
) {
	return (
		stableJson(left) ===
		stableJson({
			...right,
			target: {
				...right.target,
				calendarId: left.target.calendarId,
				googleEventId: left.target.googleEventId,
				icalUid: left.target.icalUid,
				icalSequence: left.target.icalSequence,
			},
		})
	);
}

function stableJson(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map(stableJson).join(",")}]`;
	}
	if (value && typeof value === "object") {
		return `{${Object.entries(value)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(
				([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`,
			)
			.join(",")}}`;
	}
	return JSON.stringify(value) ?? "undefined";
}

export async function getActiveAssignmentTarget(
	tx: TransactionClient,
	params: { organizationId: string; shootId: string; crewId: string },
): Promise<IntentTarget | null> {
	const [target] = await tx
		.select({
			shootId: shoots.id,
			shootStatus: shoots.status,
			crewId: crews.id,
			crewUserId: crews.userId,
			crewEmail: crews.email,
			crewName: crews.name,
			assignmentRole: shootAssignments.role,
			shootName: shoots.name,
			shootType: shoots.shootType,
			shootDate: shoots.shootDate,
			startTime: shoots.startTime,
			endTime: shoots.endTime,
			venue: shoots.venue,
			venueAddress: shoots.venueAddress,
			notes: shoots.notes,
			bookingName: bookings.name,
			bookingReferenceNumber: bookings.referenceNumber,
			organizationTimezone: organizations.timezone,
			organizationSlug: organizations.slug,
		})
		.from(shootAssignments)
		.innerJoin(
			shoots,
			and(
				eq(shootAssignments.shootId, shoots.id),
				eq(shoots.organizationId, params.organizationId),
				isNull(shoots.deletedAt),
			),
		)
		.innerJoin(
			crews,
			and(
				eq(shootAssignments.crewId, crews.id),
				eq(crews.organizationId, params.organizationId),
				isNull(crews.deletedAt),
			),
		)
		.innerJoin(
			bookings,
			and(
				eq(shoots.bookingId, bookings.id),
				eq(bookings.organizationId, params.organizationId),
			),
		)
		.innerJoin(organizations, eq(shoots.organizationId, organizations.id))
		.where(
			and(
				eq(shootAssignments.shootId, params.shootId),
				eq(shootAssignments.crewId, params.crewId),
			),
		)
		.limit(1);
	return target ?? null;
}

export function buildSnapshot(
	target: IntentTarget,
	params: {
		operation: "delivery" | "cancellation";
		intentState: IntentState;
	},
	route: {
		deliveryMethod: DeliveryMethod;
		recipientEmail: string | null;
		googleEventId?: string | null;
		calendarId?: string | null;
		icalUid?: string | null;
		icalSequence?: number | null;
	},
): CalendarSnapshot {
	const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
	return {
		operation: params.operation,
		intentState: params.intentState,
		eventInput: buildShootAllDayEventInput({
			shootName: target.shootName,
			shootType: target.shootType,
			shootDate:
				typeof target.shootDate === "string"
					? target.shootDate.slice(0, 10)
					: target.shootDate.toISOString().slice(0, 10),
			startTime: target.startTime,
			endTime: target.endTime,
			venue: target.venue,
			venueAddress: target.venueAddress,
			notes: target.notes,
			bookingName: target.bookingName,
			bookingReferenceNumber: target.bookingReferenceNumber,
			crewName: target.crewName,
			crewRole: target.assignmentRole,
			organizationTimezone: target.organizationTimezone,
			shootUrl: target.organizationSlug
				? `${baseUrl}/app/${target.organizationSlug}/shoots/${target.shootId}`
				: null,
		}),
		target: {
			deliveryMethod: route.deliveryMethod,
			recipientEmail: route.recipientEmail,
			googleUserId: target.crewUserId,
			calendarId: route.calendarId ?? null,
			googleEventId: route.googleEventId ?? null,
			icalUid: route.icalUid ?? null,
			icalSequence: route.icalSequence ?? 0,
		},
	};
}
