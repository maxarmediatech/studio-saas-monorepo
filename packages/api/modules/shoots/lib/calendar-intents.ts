import {
	and,
	calendarDeliveryIntents,
	type calendarSyncJobs,
	eq,
	googleCalendarConnections,
	isNotNull,
	isNull,
	shootCalendarEvents,
	sql,
} from "@repo/database";
import type { GoogleAllDayEventInput } from "@repo/google-calendar";
import type { TransactionClient } from "../../studio/lib/transactions";
import { isTerminalShootStatus } from "../calendar-sync";
import {
	createIntent,
	getNextIcalSequence,
	queueGeneration,
	supersedeUnstartedGenerations,
} from "./calendar-intent-persistence";
import {
	buildSnapshot,
	getActiveAssignmentTarget,
	getIcalUid,
	type IntentTarget,
	sameMaterialSnapshot,
} from "./calendar-intent-snapshot";
import { ensureActiveDeliveryJob } from "./calendar-job-recovery";
import { resolveCalendarDeliveryRoute } from "./calendar-routing";

const UNSENDABLE_REASON =
	"Crew has neither a connected Google Calendar account nor an email address";

export type CalendarJobType = NonNullable<
	typeof calendarSyncJobs.$inferInsert.jobType
>;
export type DeliveryMethod = NonNullable<
	typeof shootCalendarEvents.$inferInsert.deliveryMethod
>;
export type IntentState = "active" | "cancelled";

export type CalendarDeliveryResult = {
	crewId: string;
	shootId: string;
	deliveryMethod: DeliveryMethod;
	jobType: CalendarJobType | null;
	state: "queued" | "error" | "unsendable" | "terminal";
};

export type CalendarSnapshot = {
	operation: "delivery" | "cancellation";
	intentState: IntentState;
	eventInput: GoogleAllDayEventInput;
	target: {
		deliveryMethod: DeliveryMethod;
		recipientEmail: string | null;
		googleUserId: string | null;
		calendarId: string | null;
		googleEventId: string | null;
		icalUid: string | null;
		icalSequence: number;
	};
};

export { getCalendarDeliveryKey } from "./calendar-intent-persistence";

async function lockCalendarIntent(
	tx: TransactionClient,
	params: { organizationId: string; shootId: string; crewId: string },
) {
	// A mapping may not exist yet, so a row lock cannot serialize first intent
	// creation. PostgreSQL's transaction-scoped advisory lock serializes every
	// transition for this organization-scoped target without outliving the tx.
	await tx.execute(
		sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${params.organizationId}:${params.shootId}:${params.crewId}`}, 0))`,
	);
}

export async function ensureAssignmentCalendarDelivery(
	tx: TransactionClient,
	params: { organizationId: string; shootId: string; crewId: string },
): Promise<CalendarDeliveryResult> {
	await lockCalendarIntent(tx, params);
	const target = await getActiveAssignmentTarget(tx, params);
	if (!target) {
		throw new Error(
			"Calendar delivery target is not an active assignment in this organization",
		);
	}
	if (isTerminalShootStatus(target.shootStatus)) {
		await enqueueCalendarCancellation(tx, params);
		return {
			...params,
			deliveryMethod: "unsendable",
			jobType: null,
			state: "terminal",
		};
	}

	const [mapping, connection] = await Promise.all([
		tx.query.shootCalendarEvents.findFirst({
			where: and(
				eq(shootCalendarEvents.organizationId, params.organizationId),
				eq(shootCalendarEvents.shootId, params.shootId),
				eq(shootCalendarEvents.crewId, params.crewId),
			),
		}),
		target.crewUserId
			? tx.query.googleCalendarConnections.findFirst({
					where: and(
						eq(
							googleCalendarConnections.organizationId,
							params.organizationId,
						),
						eq(googleCalendarConnections.userId, target.crewUserId),
						isNull(googleCalendarConnections.disconnectedAt),
						isNotNull(googleCalendarConnections.refreshToken),
					),
				})
			: null,
	]);
	const route = resolveCalendarDeliveryRoute({
		hasGoogleConnection: Boolean(connection),
		email: target.crewEmail,
	});
	const currentIntent = mapping
		? await tx.query.calendarDeliveryIntents.findFirst({
				where: and(
					eq(
						calendarDeliveryIntents.organizationId,
						params.organizationId,
					),
					eq(calendarDeliveryIntents.shootId, params.shootId),
					eq(calendarDeliveryIntents.crewId, params.crewId),
					eq(
						calendarDeliveryIntents.generation,
						mapping.intentGeneration,
					),
				),
			})
		: null;
	const generation = (mapping?.intentGeneration ?? 0) + 1;
	const nextIcalSequence = await getNextIcalSequence(
		tx,
		params,
		mapping?.deliveredIcalSequence ?? -1,
	);
	const continuesDeliveredIcs =
		route.deliveryMethod === "ics" &&
		mapping?.deliveredDeliveryMethod === "ics" &&
		mapping.deliveredRecipientEmail === route.recipientEmail &&
		Boolean(mapping.deliveredIcalUid);
	const icalUid =
		route.deliveryMethod === "ics"
			? continuesDeliveredIcs
				? (mapping?.deliveredIcalUid ?? null)
				: getIcalUid(params.shootId, params.crewId, generation)
			: null;
	const currentSnapshot = currentIntent?.payload as
		| CalendarSnapshot
		| undefined;
	const comparableActiveSnapshot =
		mapping?.intentState === "active" &&
		currentIntent?.deliveryMethod === route.deliveryMethod &&
		currentIntent.recipientEmail === route.recipientEmail &&
		currentSnapshot?.operation === "delivery"
			? currentSnapshot
			: null;
	const nextTarget = {
		deliveryMethod: route.deliveryMethod,
		recipientEmail: route.recipientEmail,
		googleEventId:
			route.deliveryMethod === "google" &&
			mapping?.deliveredDeliveryMethod === "google"
				? mapping.deliveredGoogleEventId
				: null,
		icalUid,
		icalSequence: route.deliveryMethod === "ics" ? nextIcalSequence : 0,
	};
	const snapshot = buildSnapshot(
		target,
		{ operation: "delivery", intentState: "active" },
		nextTarget,
	);
	if (
		comparableActiveSnapshot &&
		sameMaterialSnapshot(comparableActiveSnapshot, snapshot)
	) {
		if (route.deliveryMethod !== "unsendable" && currentIntent && mapping) {
			const state = await ensureActiveDeliveryJob(tx, {
				...params,
				mappingId: mapping.id,
				deliveryMethod: route.deliveryMethod,
				intent: currentIntent,
				snapshot: comparableActiveSnapshot,
			});
			if (state === "error") {
				return {
					...params,
					deliveryMethod: route.deliveryMethod,
					jobType: null,
					state: "error",
				};
			}
		}
		return {
			...params,
			deliveryMethod: route.deliveryMethod,
			jobType: null,
			state:
				route.deliveryMethod === "unsendable" ? "unsendable" : "queued",
		};
	}
	await supersedeUnstartedGenerations(tx, params);
	const intent = await createIntent(tx, {
		...params,
		generation,
		state: "active",
		deliveryMethod: route.deliveryMethod,
		recipientEmail: route.recipientEmail,
		icalUid,
		snapshot,
	});

	const deliveredRouteChanged =
		mapping?.deliveredGeneration != null &&
		(mapping.deliveredDeliveryMethod !== route.deliveryMethod ||
			mapping.deliveredRecipientEmail !== route.recipientEmail);
	if (mapping?.deliveredGeneration != null && deliveredRouteChanged) {
		await queueReplacementCancellation(tx, {
			...params,
			generation,
			intentId: intent.id,
			mapping,
			target,
		});
	}

	await tx
		.insert(shootCalendarEvents)
		.values({
			organizationId: params.organizationId,
			shootId: params.shootId,
			crewId: params.crewId,
			deliveryMethod: route.deliveryMethod,
			recipientEmail: route.recipientEmail,
			icalUid,
			icalSequence: snapshot.target.icalSequence,
			intentGeneration: generation,
			intentState: "active",
			syncStatus:
				route.deliveryMethod === "unsendable"
					? "unsendable"
					: "pending",
			lastError:
				route.deliveryMethod === "unsendable"
					? UNSENDABLE_REASON
					: null,
			updatedAt: new Date(),
		})
		.onConflictDoUpdate({
			target: [
				shootCalendarEvents.organizationId,
				shootCalendarEvents.shootId,
				shootCalendarEvents.crewId,
			],
			set: {
				deliveryMethod: route.deliveryMethod,
				recipientEmail: route.recipientEmail,
				icalUid,
				icalSequence: snapshot.target.icalSequence,
				googleEventId: null,
				calendarId: null,
				intentGeneration: generation,
				intentState: "active",
				syncStatus:
					route.deliveryMethod === "unsendable"
						? "unsendable"
						: "pending",
				lastError:
					route.deliveryMethod === "unsendable"
						? UNSENDABLE_REASON
						: null,
				updatedAt: new Date(),
			},
		});

	if (route.deliveryMethod === "unsendable") {
		return {
			...params,
			deliveryMethod: route.deliveryMethod,
			jobType: null,
			state: "unsendable",
		};
	}
	const jobType: CalendarJobType =
		route.deliveryMethod === "google"
			? mapping?.deliveredGoogleEventId
				? "google_update"
				: "google_create"
			: mapping?.deliveredIcalUid
				? "ics_send_update"
				: "ics_send_invite";
	await queueGeneration(tx, {
		...params,
		intentId: intent.id,
		generation,
		jobType,
		kind: "delivery",
		snapshot,
	});
	return {
		...params,
		deliveryMethod: route.deliveryMethod,
		jobType,
		state: "queued",
	};
}

async function queueReplacementCancellation(
	tx: TransactionClient,
	params: {
		organizationId: string;
		shootId: string;
		crewId: string;
		generation: number;
		intentId: string;
		mapping: typeof shootCalendarEvents.$inferSelect;
		target: IntentTarget;
	},
) {
	const method = params.mapping.deliveredDeliveryMethod;
	if (!method || method === "unsendable") {
		return;
	}
	const snapshot = buildSnapshot(
		params.target,
		{ operation: "cancellation", intentState: "active" },
		{
			deliveryMethod: method,
			recipientEmail: params.mapping.deliveredRecipientEmail,
			calendarId: params.mapping.deliveredCalendarId,
			googleEventId: params.mapping.deliveredGoogleEventId,
			icalUid: params.mapping.deliveredIcalUid,
			icalSequence: (params.mapping.deliveredIcalSequence ?? 0) + 1,
		},
	);
	await queueGeneration(tx, {
		...params,
		jobType: method === "ics" ? "ics_send_cancel" : "google_delete",
		kind: "cancellation",
		snapshot,
	});
}

export async function enqueueCalendarCancellation(
	tx: TransactionClient,
	params: { organizationId: string; shootId: string; crewId: string },
) {
	await lockCalendarIntent(tx, params);
	const mapping = await tx.query.shootCalendarEvents.findFirst({
		where: and(
			eq(shootCalendarEvents.organizationId, params.organizationId),
			eq(shootCalendarEvents.shootId, params.shootId),
			eq(shootCalendarEvents.crewId, params.crewId),
		),
	});
	if (!mapping) {
		return null;
	}
	if (mapping.intentState === "cancelled") {
		return mapping.deliveryMethod === "unsendable"
			? null
			: mapping.deliveryMethod === "ics"
				? "ics_send_cancel"
				: "google_delete";
	}
	const target = await getActiveAssignmentTarget(tx, params);
	const deliveredIntent = mapping.deliveredGeneration
		? await tx.query.calendarDeliveryIntents.findFirst({
				where: and(
					eq(
						calendarDeliveryIntents.organizationId,
						params.organizationId,
					),
					eq(calendarDeliveryIntents.shootId, params.shootId),
					eq(calendarDeliveryIntents.crewId, params.crewId),
					eq(
						calendarDeliveryIntents.generation,
						mapping.deliveredGeneration,
					),
				),
			})
		: null;
	const deliveredSnapshot = deliveredIntent?.payload as
		| CalendarSnapshot
		| undefined;
	if (!target && !deliveredSnapshot) {
		throw new Error(
			"Cannot cancel stale calendar mapping without a delivered immutable intent snapshot",
		);
	}
	const generation = mapping.intentGeneration + 1;
	const method = mapping.deliveredDeliveryMethod ?? mapping.deliveryMethod;
	const nextIcalSequence = await getNextIcalSequence(
		tx,
		params,
		mapping.deliveredIcalSequence ?? mapping.icalSequence,
	);
	const cancellationTarget = {
		deliveryMethod: method,
		recipientEmail:
			mapping.deliveredRecipientEmail ??
			deliveredSnapshot?.target.recipientEmail ??
			mapping.recipientEmail,
		calendarId:
			mapping.deliveredCalendarId ??
			deliveredSnapshot?.target.calendarId ??
			mapping.calendarId,
		googleEventId:
			mapping.deliveredGoogleEventId ??
			deliveredSnapshot?.target.googleEventId ??
			mapping.googleEventId,
		googleUserId: deliveredSnapshot?.target.googleUserId ?? null,
		icalUid:
			mapping.deliveredIcalUid ??
			deliveredSnapshot?.target.icalUid ??
			mapping.icalUid,
		icalSequence: nextIcalSequence,
	};
	const snapshot: CalendarSnapshot = deliveredSnapshot
		? {
				...deliveredSnapshot,
				operation: "cancellation",
				intentState: "cancelled",
				target: { ...deliveredSnapshot.target, ...cancellationTarget },
			}
		: buildSnapshot(
				target as IntentTarget,
				{ operation: "cancellation", intentState: "cancelled" },
				cancellationTarget,
			);
	await supersedeUnstartedGenerations(tx, params);
	const intent = await createIntent(tx, {
		...params,
		generation,
		state: "cancelled",
		deliveryMethod: method,
		recipientEmail: snapshot.target.recipientEmail,
		calendarId: snapshot.target.calendarId,
		googleEventId: snapshot.target.googleEventId,
		icalUid: snapshot.target.icalUid,
		icalSequence: snapshot.target.icalSequence,
		snapshot,
	});
	await tx
		.update(shootCalendarEvents)
		.set({
			intentGeneration: generation,
			intentState: "cancelled",
			syncStatus: method === "unsendable" ? "deleted" : "pending",
			lastSyncedAt: method === "unsendable" ? new Date() : undefined,
			lastError: null,
			updatedAt: new Date(),
		})
		.where(eq(shootCalendarEvents.id, mapping.id));
	if (method === "unsendable") {
		return null;
	}
	const jobType: CalendarJobType =
		method === "ics" ? "ics_send_cancel" : "google_delete";
	await queueGeneration(tx, {
		...params,
		intentId: intent.id,
		generation,
		jobType,
		kind: "cancellation",
		snapshot,
	});
	return jobType;
}
