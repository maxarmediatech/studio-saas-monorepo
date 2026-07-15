import { createHash } from "node:crypto";
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
import { markCancellationForManualReconciliation } from "./calendar-cancellation-state";
import { readDeliveredCalendarIdentity } from "./calendar-delivered-identity";
import {
	createIntent,
	getNextIcalSequence,
	queueGeneration,
	supersedeUnstartedGenerations,
} from "./calendar-intent-persistence";
import {
	buildSnapshot,
	getActiveAssignmentTarget,
	getCancellationEnrichmentTarget,
	getIcalUid,
	type IntentTarget,
	sameMaterialSnapshot,
} from "./calendar-intent-snapshot";
import {
	ensureActiveDeliveryJob,
	repairCancellationJob,
} from "./calendar-job-recovery";
import { queueReplacementCancellation } from "./calendar-replacement-cancellation";
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
	state:
		| "queued"
		| "error"
		| "unsendable"
		| "terminal"
		| "manual_reconciliation";
};

export type CalendarSnapshot = {
	operation: "delivery" | "cancellation";
	intentState: IntentState;
	eventInput: GoogleAllDayEventInput;
	target: {
		deliveryMethod: DeliveryMethod;
		recipientEmail: string | null;
		googleUserId: string | null;
		googleConnectionId: string | null;
		googleAccountEmail: string | null;
		googleCreateId: string | null;
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
	const deliveredIdentity = mapping
		? await readDeliveredCalendarIdentity(tx, {
				mapping,
				crewUserId: target.crewUserId,
			})
		: ({
				kind: "no_effect",
				reason: "No calendar mapping exists",
			} as const);
	if (mapping && deliveredIdentity.kind === "manual_reconciliation") {
		await markCancellationForManualReconciliation(
			tx,
			mapping.id,
			deliveredIdentity.reason,
			false,
		);
		return {
			...params,
			deliveryMethod: route.deliveryMethod,
			jobType: null,
			state: "manual_reconciliation",
		};
	}
	const generation = (mapping?.intentGeneration ?? 0) + 1;
	const sameDeliveredRoute =
		deliveredIdentity.kind === "actionable" &&
		(deliveredIdentity.deliveryMethod === "google"
			? route.deliveryMethod === "google" &&
				deliveredIdentity.target.googleConnectionId === connection?.id
			: route.deliveryMethod === "ics" &&
				deliveredIdentity.target.recipientEmail ===
					route.recipientEmail);
	const deliveredRouteChanged =
		deliveredIdentity.kind === "actionable" && !sameDeliveredRoute;
	const nextIcalSequence = await getNextIcalSequence(
		tx,
		params,
		deliveredIdentity.kind === "actionable" &&
			deliveredIdentity.deliveryMethod === "ics"
			? deliveredIdentity.target.icalSequence
			: -1,
	);
	const continuesDeliveredIcs =
		route.deliveryMethod === "ics" &&
		sameDeliveredRoute &&
		deliveredIdentity.kind === "actionable" &&
		deliveredIdentity.deliveryMethod === "ics";
	const continuesDeliveredGoogle =
		route.deliveryMethod === "google" &&
		sameDeliveredRoute &&
		deliveredIdentity.kind === "actionable" &&
		deliveredIdentity.deliveryMethod === "google";
	const icalUid =
		route.deliveryMethod === "ics"
			? continuesDeliveredIcs
				? deliveredIdentity.target.icalUid
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
		googleConnectionId:
			route.deliveryMethod === "google" ? (connection?.id ?? null) : null,
		googleAccountEmail:
			route.deliveryMethod === "google"
				? (connection?.googleAccountEmail ?? null)
				: null,
		googleCreateId:
			route.deliveryMethod === "google" && !continuesDeliveredGoogle
				? createHash("sha256")
						.update(
							`${params.organizationId}:${params.shootId}:${params.crewId}:${generation}:${connection?.id}`,
						)
						.digest("hex")
						.slice(0, 32)
				: null,
		googleEventId: continuesDeliveredGoogle
			? deliveredIdentity.target.googleEventId
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
	const intent = await createIntent(tx, {
		...params,
		generation,
		state: "active",
		deliveryMethod: route.deliveryMethod,
		recipientEmail: route.recipientEmail,
		icalUid,
		googleConnectionId: snapshot.target.googleConnectionId,
		googleAccountEmail: snapshot.target.googleAccountEmail,
		snapshot,
	});

	let replacementCancellation:
		| Awaited<ReturnType<typeof queueReplacementCancellation>>
		| undefined;
	if (
		mapping &&
		deliveredRouteChanged &&
		deliveredIdentity.kind === "actionable"
	) {
		replacementCancellation = await queueReplacementCancellation(tx, {
			...params,
			generation,
			intentId: intent.id,
			mapping,
			target,
			deliveredIdentity,
		});
		if (replacementCancellation.state === "manual_reconciliation") {
			await tx
				.delete(calendarDeliveryIntents)
				.where(eq(calendarDeliveryIntents.id, intent.id));
			return {
				...params,
				deliveryMethod: route.deliveryMethod,
				jobType: null,
				state: "manual_reconciliation",
			};
		}
	}
	await supersedeUnstartedGenerations(tx, params);
	const cancellationSyncStatus = deliveredRouteChanged
		? replacementCancellation?.state === "manual_reconciliation"
			? "manual_reconciliation"
			: "pending"
		: (mapping?.cancellationSyncStatus ?? "none");
	const cancellationLastError = deliveredRouteChanged
		? replacementCancellation?.state === "manual_reconciliation"
			? (replacementCancellation.reason ??
				"Calendar cancellation requires manual reconciliation")
			: null
		: mapping?.cancellationLastError;
	const retainedDeliveredIdentity =
		mapping && deliveredIdentity.kind === "actionable"
			? {
					deliveredGeneration:
						mapping.deliveredGeneration ?? mapping.intentGeneration,
					deliveredDeliveryMethod: deliveredIdentity.deliveryMethod,
					deliveredRecipientEmail:
						deliveredIdentity.target.recipientEmail,
					deliveredCalendarId: deliveredIdentity.target.calendarId,
					deliveredGoogleEventId:
						deliveredIdentity.target.googleEventId,
					deliveredIcalUid: deliveredIdentity.target.icalUid,
					deliveredIcalSequence:
						deliveredIdentity.target.icalSequence,
				}
			: {};

	await tx
		.insert(shootCalendarEvents)
		.values({
			organizationId: params.organizationId,
			shootId: params.shootId,
			crewId: params.crewId,
			deliveryMethod: route.deliveryMethod,
			recipientEmail: route.recipientEmail,
			calendarId: continuesDeliveredGoogle
				? deliveredIdentity.target.calendarId
				: null,
			googleEventId: continuesDeliveredGoogle
				? deliveredIdentity.target.googleEventId
				: null,
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
			deliverySyncStatus:
				route.deliveryMethod === "unsendable"
					? "unsendable"
					: "pending",
			deliveryLastError:
				route.deliveryMethod === "unsendable"
					? UNSENDABLE_REASON
					: null,
			cancellationSyncStatus,
			cancellationLastError,
			updatedAt: new Date(),
		})
		.onConflictDoUpdate({
			target: [
				shootCalendarEvents.organizationId,
				shootCalendarEvents.shootId,
				shootCalendarEvents.crewId,
			],
			set: {
				...retainedDeliveredIdentity,
				deliveryMethod: route.deliveryMethod,
				recipientEmail: route.recipientEmail,
				icalUid,
				icalSequence: snapshot.target.icalSequence,
				googleEventId: continuesDeliveredGoogle
					? deliveredIdentity.target.googleEventId
					: null,
				calendarId: continuesDeliveredGoogle
					? deliveredIdentity.target.calendarId
					: null,
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
				deliverySyncStatus:
					route.deliveryMethod === "unsendable"
						? "unsendable"
						: "pending",
				deliveryLastError:
					route.deliveryMethod === "unsendable"
						? UNSENDABLE_REASON
						: null,
				cancellationSyncStatus,
				cancellationLastError,
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
			? continuesDeliveredGoogle
				? "google_update"
				: "google_create"
			: continuesDeliveredIcs
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
	const activeTarget = await getActiveAssignmentTarget(tx, params);
	const target =
		activeTarget ?? (await getCancellationEnrichmentTarget(tx, params));
	if (mapping.intentState === "cancelled") {
		if (
			mapping.cancellationSyncStatus === "synced" ||
			mapping.cancellationSyncStatus === "manual_reconciliation"
		) {
			return mapping.cancellationSyncStatus === "manual_reconciliation"
				? ("manual_reconciliation" as const)
				: null;
		}
		const intent = await tx.query.calendarDeliveryIntents.findFirst({
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
		});
		if (intent) {
			const evidence = await readDeliveredCalendarIdentity(tx, {
				mapping,
				crewUserId: target?.crewUserId ?? null,
				deliveredSnapshot: intent.payload as CalendarSnapshot,
			});
			if (evidence.kind === "no_effect") {
				await tx
					.update(shootCalendarEvents)
					.set({
						syncStatus: "deleted",
						lastSyncedAt: new Date(),
						lastError: evidence.reason,
						cancellationSyncStatus: "synced",
						cancellationLastError: evidence.reason,
						updatedAt: new Date(),
					})
					.where(eq(shootCalendarEvents.id, mapping.id));
				return null;
			}
			if (evidence.kind === "manual_reconciliation") {
				await markCancellationForManualReconciliation(
					tx,
					mapping.id,
					evidence.reason,
					true,
				);
				return "manual_reconciliation" as const;
			}
			return repairCancellationJob(tx, {
				...params,
				mappingId: mapping.id,
				intent,
				deliveryMethod: intent.deliveryMethod,
			});
		}
	}
	const evidence = await readDeliveredCalendarIdentity(tx, {
		mapping,
		crewUserId: target?.crewUserId ?? null,
	});
	if (evidence.kind === "no_effect") {
		await tx
			.update(shootCalendarEvents)
			.set({
				intentState: "cancelled",
				syncStatus: "deleted",
				lastSyncedAt: new Date(),
				lastError: evidence.reason,
				cancellationSyncStatus: "synced",
				cancellationLastError: evidence.reason,
				updatedAt: new Date(),
			})
			.where(eq(shootCalendarEvents.id, mapping.id));
		return null;
	}
	if (evidence.kind === "manual_reconciliation") {
		await markCancellationForManualReconciliation(
			tx,
			mapping.id,
			evidence.reason,
			true,
		);
		return "manual_reconciliation" as const;
	}
	const deliveredSnapshot = evidence.deliveredSnapshot;
	if (!deliveredSnapshot && !target) {
		await markCancellationForManualReconciliation(
			tx,
			mapping.id,
			"Stored provider identity exists but event content cannot be reconstructed",
			true,
		);
		return "manual_reconciliation" as const;
	}
	const generation = mapping.intentGeneration + 1;
	const method = evidence.deliveryMethod;
	const nextIcalSequence = await getNextIcalSequence(
		tx,
		params,
		evidence.target.icalSequence,
	);
	const cancellationTarget = {
		...evidence.target,
		icalSequence:
			method === "ics" ? nextIcalSequence : evidence.target.icalSequence,
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
		googleConnectionId: snapshot.target.googleConnectionId,
		googleAccountEmail: snapshot.target.googleAccountEmail,
		snapshot,
	});
	await tx
		.update(shootCalendarEvents)
		.set({
			intentGeneration: generation,
			intentState: "cancelled",
			syncStatus: "pending",
			lastError: null,
			cancellationSyncStatus: "pending",
			cancellationLastError: null,
			updatedAt: new Date(),
		})
		.where(eq(shootCalendarEvents.id, mapping.id));
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
