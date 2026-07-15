import {
	and,
	calendarDeliveryIntents,
	calendarSyncJobs,
	eq,
	inArray,
	sql,
} from "@repo/database";
import type { TransactionClient } from "../../studio/lib/transactions";
import type {
	CalendarJobType,
	CalendarSnapshot,
	DeliveryMethod,
	IntentState,
} from "./calendar-intents";

export async function getNextIcalSequence(
	tx: TransactionClient,
	params: { organizationId: string; shootId: string; crewId: string },
	floor = -1,
) {
	const [intentRow] = await tx
		.select({
			sequence: sql<number>`COALESCE(MAX(${calendarDeliveryIntents.icalSequence}), -1)`,
		})
		.from(calendarDeliveryIntents)
		.where(
			and(
				eq(
					calendarDeliveryIntents.organizationId,
					params.organizationId,
				),
				eq(calendarDeliveryIntents.shootId, params.shootId),
				eq(calendarDeliveryIntents.crewId, params.crewId),
			),
		);
	const [compensationRow] = await tx
		.select({
			sequence: sql<number>`COALESCE(MAX(${calendarSyncJobs.compensationSequence}), -1)`,
		})
		.from(calendarSyncJobs)
		.where(
			and(
				eq(calendarSyncJobs.organizationId, params.organizationId),
				eq(calendarSyncJobs.shootId, params.shootId),
				eq(calendarSyncJobs.crewId, params.crewId),
			),
		);
	return (
		Math.max(
			Number(intentRow?.sequence ?? -1),
			Number(compensationRow?.sequence ?? -1),
			floor,
		) + 1
	);
}

export function getCalendarDeliveryKey(params: {
	organizationId: string;
	shootId: string;
	crewId: string;
	generation: number;
	kind: "delivery" | "cancellation";
}) {
	return [
		"calendar",
		params.organizationId,
		params.shootId,
		params.crewId,
		params.kind,
		params.generation,
	].join(":");
}

export async function queueGeneration(
	tx: TransactionClient,
	params: {
		organizationId: string;
		shootId: string;
		crewId: string;
		intentId: string;
		generation: number;
		jobType: CalendarJobType;
		kind: "delivery" | "cancellation";
		snapshot: CalendarSnapshot;
	},
) {
	await tx
		.insert(calendarSyncJobs)
		.values({
			organizationId: params.organizationId,
			deliveryKey: getCalendarDeliveryKey(params),
			status: "pending",
			jobType: params.jobType,
			shootId: params.shootId,
			crewId: params.crewId,
			intentId: params.intentId,
			generation: params.generation,
			payload: params.snapshot,
		})
		.onConflictDoNothing();
}

export async function supersedeUnstartedGenerations(
	tx: TransactionClient,
	params: { organizationId: string; shootId: string; crewId: string },
) {
	await tx
		.update(calendarSyncJobs)
		.set({
			status: "completed",
			nextAttemptAt: null,
			lockedAt: null,
			lastError: "Superseded by a newer calendar intent",
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(calendarSyncJobs.organizationId, params.organizationId),
				eq(calendarSyncJobs.shootId, params.shootId),
				eq(calendarSyncJobs.crewId, params.crewId),
				inArray(calendarSyncJobs.status, ["pending", "failed"]),
				inArray(calendarSyncJobs.jobType, [
					"google_create",
					"google_update",
					"ics_send_invite",
					"ics_send_update",
				]),
			),
		);
}

export async function createIntent(
	tx: TransactionClient,
	params: {
		organizationId: string;
		shootId: string;
		crewId: string;
		generation: number;
		state: IntentState;
		deliveryMethod: DeliveryMethod;
		recipientEmail: string | null;
		calendarId?: string | null;
		googleEventId?: string | null;
		icalUid?: string | null;
		icalSequence?: number | null;
		googleConnectionId?: string | null;
		googleAccountEmail?: string | null;
		snapshot: CalendarSnapshot;
	},
) {
	const [intent] = await tx
		.insert(calendarDeliveryIntents)
		.values({
			organizationId: params.organizationId,
			shootId: params.shootId,
			crewId: params.crewId,
			generation: params.generation,
			state: params.state,
			deliveryMethod: params.deliveryMethod,
			recipientEmail: params.recipientEmail,
			calendarId: params.calendarId ?? null,
			googleEventId: params.googleEventId ?? null,
			icalUid: params.icalUid ?? null,
			icalSequence: params.icalSequence ?? 0,
			googleConnectionId: params.googleConnectionId ?? null,
			googleAccountEmail: params.googleAccountEmail ?? null,
			payload: params.snapshot,
		})
		.returning({ id: calendarDeliveryIntents.id });
	if (!intent) {
		throw new Error("Could not persist calendar delivery intent");
	}
	return intent;
}
