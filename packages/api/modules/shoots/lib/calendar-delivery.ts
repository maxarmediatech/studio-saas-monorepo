import {
	and,
	calendarSyncJobs,
	crews,
	db,
	eq,
	googleCalendarConnections,
	isNotNull,
	isNull,
	ne,
	organizations,
	shootAssignments,
	shootCalendarEvents,
	shoots,
	sql,
} from "@repo/database";
import { logger } from "@repo/logs";
import type { TransactionClient } from "../../studio/lib/transactions";
import { isTerminalShootStatus } from "../calendar-sync";
import { resolveCalendarDeliveryRoute } from "./calendar-routing";

const UNSENDABLE_REASON =
	"Crew has neither a connected Google Calendar account nor an email address";

type CalendarJobType = typeof calendarSyncJobs.$inferInsert.jobType;
type DeliveryMethod = typeof shootCalendarEvents.$inferInsert.deliveryMethod;

export type CalendarDeliveryResult = {
	crewId: string;
	shootId: string;
	deliveryMethod: DeliveryMethod;
	jobType: CalendarJobType | null;
	state: "queued" | "error" | "unsendable" | "terminal";
};

export function getCalendarDeliveryKey(params: {
	organizationId: string;
	shootId: string;
	crewId: string;
	kind?: "delivery" | "cancellation";
}) {
	return [
		"calendar",
		params.organizationId,
		params.shootId,
		params.crewId,
		params.kind ?? "delivery",
	].join(":");
}

function getIcalUid(shootId: string, crewId: string) {
	return `shoot-${shootId}-crew-${crewId}@studio-saas.invalid`;
}

async function queueJob(
	tx: TransactionClient,
	params: {
		organizationId: string;
		shootId: string;
		crewId: string;
		jobType: CalendarJobType;
		kind?: "delivery" | "cancellation";
		nextAttemptAt?: Date | null;
	},
) {
	const now = new Date();
	const deliveryKey = getCalendarDeliveryKey(params);

	await tx
		.insert(calendarSyncJobs)
		.values({
			organizationId: params.organizationId,
			deliveryKey,
			status: "pending",
			jobType: params.jobType,
			shootId: params.shootId,
			crewId: params.crewId,
			nextAttemptAt: params.nextAttemptAt ?? null,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: calendarSyncJobs.deliveryKey,
			targetWhere: sql`${calendarSyncJobs.status} <> 'completed'`,
			// Existing pending/processing/retryable failed jobs already carry the
			// current target identity. Do not reset their lease, backoff, or attempt
			// count when a producer retries. Only revive an exhausted job.
			setWhere: sql`${calendarSyncJobs.status} = 'failed'
				AND COALESCE(${calendarSyncJobs.attempts}, 0) >= COALESCE(${calendarSyncJobs.maxAttempts}, 5)`,
			set: {
				jobType: params.jobType,
				status: "pending",
				attempts: 0,
				lastAttemptAt: null,
				nextAttemptAt: params.nextAttemptAt ?? null,
				lockedAt: null,
				lastError: null,
				updatedAt: now,
			},
		});
}

async function markProducerFailure(
	tx: TransactionClient,
	params: { organizationId: string; shootId: string; crewId: string },
	error: unknown,
) {
	const message = `Calendar producer failed: ${getErrorMessage(error)}`;
	await tx
		.update(shootCalendarEvents)
		.set({ syncStatus: "error", lastError: message, updatedAt: new Date() })
		.where(
			and(
				eq(shootCalendarEvents.organizationId, params.organizationId),
				eq(shootCalendarEvents.shootId, params.shootId),
				eq(shootCalendarEvents.crewId, params.crewId),
			),
		);
	logger.error("Calendar delivery job could not be queued", {
		...params,
		error: message,
	});
}

function getErrorMessage(error: unknown): string {
	if (!(error instanceof Error)) {
		return String(error);
	}
	const cause = (error as Error & { cause?: unknown }).cause;
	return cause instanceof Error
		? `${error.message}; cause: ${getErrorMessage(cause)}`
		: error.message;
}

export async function ensureAssignmentCalendarDelivery(
	tx: TransactionClient,
	params: { organizationId: string; shootId: string; crewId: string },
): Promise<CalendarDeliveryResult> {
	const [target] = await tx
		.select({
			shootId: shoots.id,
			shootStatus: shoots.status,
			crewId: crews.id,
			crewUserId: crews.userId,
			crewEmail: crews.email,
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
		.where(
			and(
				eq(shootAssignments.shootId, params.shootId),
				eq(shootAssignments.crewId, params.crewId),
			),
		)
		.limit(1);

	if (!target) {
		throw new Error(
			"Calendar delivery target is not an active assignment in this organization",
		);
	}

	if (isTerminalShootStatus(target.shootStatus)) {
		return {
			crewId: target.crewId,
			shootId: target.shootId,
			deliveryMethod: "unsendable",
			jobType: null,
			state: "terminal",
		};
	}

	const connection = target.crewUserId
		? await tx.query.googleCalendarConnections.findFirst({
				where: and(
					eq(
						googleCalendarConnections.organizationId,
						params.organizationId,
					),
					eq(googleCalendarConnections.userId, target.crewUserId),
					isNull(googleCalendarConnections.disconnectedAt),
					isNotNull(googleCalendarConnections.refreshToken),
				),
				columns: { id: true },
			})
		: null;

	const mapping = await tx.query.shootCalendarEvents.findFirst({
		where: and(
			eq(shootCalendarEvents.organizationId, params.organizationId),
			eq(shootCalendarEvents.shootId, params.shootId),
			eq(shootCalendarEvents.crewId, params.crewId),
		),
	});

	const route = resolveCalendarDeliveryRoute({
		hasGoogleConnection: Boolean(connection),
		email: target.crewEmail,
	});
	const deliveryMethod: DeliveryMethod = route.deliveryMethod;
	const now = new Date();
	const icalUid =
		mapping?.icalUid ?? getIcalUid(params.shootId, params.crewId);

	await tx
		.insert(shootCalendarEvents)
		.values({
			organizationId: params.organizationId,
			shootId: params.shootId,
			crewId: params.crewId,
			deliveryMethod,
			recipientEmail: route.recipientEmail,
			icalUid: deliveryMethod === "ics" ? icalUid : mapping?.icalUid,
			syncStatus:
				deliveryMethod === "unsendable" ? "unsendable" : "pending",
			lastError:
				deliveryMethod === "unsendable" ? UNSENDABLE_REASON : null,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: [
				shootCalendarEvents.organizationId,
				shootCalendarEvents.shootId,
				shootCalendarEvents.crewId,
			],
			set: {
				organizationId: params.organizationId,
				deliveryMethod,
				recipientEmail: route.recipientEmail,
				icalUid: deliveryMethod === "ics" ? icalUid : mapping?.icalUid,
				syncStatus:
					deliveryMethod === "unsendable" ? "unsendable" : "pending",
				lastError:
					deliveryMethod === "unsendable" ? UNSENDABLE_REASON : null,
				updatedAt: now,
			},
		});

	if (deliveryMethod === "unsendable") {
		return {
			crewId: target.crewId,
			shootId: target.shootId,
			deliveryMethod,
			jobType: null,
			state: "unsendable",
		};
	}

	const jobType: CalendarJobType =
		deliveryMethod === "google"
			? mapping?.googleEventId
				? "google_update"
				: "google_create"
			: mapping?.deliveryMethod === "ics" &&
					mapping.syncStatus === "synced"
				? "ics_send_update"
				: "ics_send_invite";

	try {
		await tx.transaction((jobTx) =>
			queueJob(jobTx, { ...params, jobType }),
		);
	} catch (error) {
		await markProducerFailure(tx, params, error);
		return {
			crewId: target.crewId,
			shootId: target.shootId,
			deliveryMethod,
			jobType,
			state: "error",
		};
	}

	return {
		crewId: target.crewId,
		shootId: target.shootId,
		deliveryMethod,
		jobType,
		state: "queued",
	};
}

export async function enqueueCalendarCancellation(
	tx: TransactionClient,
	params: { organizationId: string; shootId: string; crewId: string },
) {
	const mapping = await tx.query.shootCalendarEvents.findFirst({
		where: and(
			eq(shootCalendarEvents.organizationId, params.organizationId),
			eq(shootCalendarEvents.shootId, params.shootId),
			eq(shootCalendarEvents.crewId, params.crewId),
		),
	});

	if (!mapping || mapping.deliveryMethod === "unsendable") {
		if (mapping) {
			await tx
				.update(shootCalendarEvents)
				.set({
					syncStatus: "deleted",
					lastError: null,
					updatedAt: new Date(),
				})
				.where(eq(shootCalendarEvents.id, mapping.id));
		}
		return null;
	}

	const jobType: CalendarJobType =
		mapping.deliveryMethod === "ics" ? "ics_send_cancel" : "google_delete";
	const deliveryKey = getCalendarDeliveryKey(params);
	const activeDeliveryJob = await tx.query.calendarSyncJobs.findFirst({
		where: and(
			eq(calendarSyncJobs.deliveryKey, deliveryKey),
			ne(calendarSyncJobs.status, "completed"),
		),
		columns: { id: true, status: true },
	});
	await tx
		.update(shootCalendarEvents)
		.set({ syncStatus: "pending", lastError: null, updatedAt: new Date() })
		.where(eq(shootCalendarEvents.id, mapping.id));

	try {
		await tx.transaction(async (jobTx) => {
			let cancellationMustWait =
				activeDeliveryJob?.status === "processing";
			if (activeDeliveryJob && !cancellationMustWait) {
				const superseded = await jobTx
					.update(calendarSyncJobs)
					.set({
						status: "completed",
						nextAttemptAt: null,
						lockedAt: null,
						lastError: "Superseded by calendar cancellation",
						updatedAt: new Date(),
					})
					.where(
						and(
							eq(calendarSyncJobs.id, activeDeliveryJob.id),
							ne(calendarSyncJobs.status, "processing"),
						),
					)
					.returning({ id: calendarSyncJobs.id });
				cancellationMustWait = superseded.length === 0;
			}
			return queueJob(jobTx, {
				...params,
				jobType,
				kind: "cancellation",
				nextAttemptAt: cancellationMustWait
					? new Date(Date.now() + 60_000)
					: null,
			});
		});
	} catch (error) {
		await markProducerFailure(tx, params, error);
	}
	return jobType;
}

export async function reconcileCalendarDeliveries(params: {
	organizationId?: string;
	crewId?: string;
	apply: boolean;
}) {
	const candidates = await db
		.select({
			organizationId: organizations.id,
			shootId: shootAssignments.shootId,
			crewId: shootAssignments.crewId,
		})
		.from(shootAssignments)
		.innerJoin(
			shoots,
			and(
				eq(shootAssignments.shootId, shoots.id),
				isNull(shoots.deletedAt),
				sql`${shoots.status} NOT IN ('completed', 'cancelled')`,
			),
		)
		.innerJoin(
			crews,
			and(
				eq(shootAssignments.crewId, crews.id),
				eq(crews.organizationId, shoots.organizationId),
				isNull(crews.deletedAt),
			),
		)
		.innerJoin(organizations, eq(shoots.organizationId, organizations.id))
		.leftJoin(
			shootCalendarEvents,
			and(
				eq(shootCalendarEvents.organizationId, organizations.id),
				eq(shootCalendarEvents.shootId, shootAssignments.shootId),
				eq(shootCalendarEvents.crewId, shootAssignments.crewId),
			),
		)
		.where(
			and(
				params.organizationId
					? eq(organizations.id, params.organizationId)
					: undefined,
				params.crewId
					? eq(shootAssignments.crewId, params.crewId)
					: undefined,
				sql`(
					${shootCalendarEvents.id} IS NULL
					OR ${shootCalendarEvents.syncStatus} IN ('error', 'unsendable')
					OR (
						${shootCalendarEvents.syncStatus} = 'pending'
						AND NOT EXISTS (
							SELECT 1 FROM ${calendarSyncJobs}
							WHERE ${calendarSyncJobs.organizationId} = ${organizations.id}
							AND ${calendarSyncJobs.shootId} = ${shootAssignments.shootId}
							AND ${calendarSyncJobs.crewId} = ${shootAssignments.crewId}
							AND ${calendarSyncJobs.status} <> 'completed'
						)
					)
				)`,
			),
		);

	if (!params.apply) {
		return { candidates: candidates.length, reconciled: 0, failed: 0 };
	}

	let reconciled = 0;
	let failed = 0;
	for (const candidate of candidates) {
		try {
			await db.transaction((tx) =>
				ensureAssignmentCalendarDelivery(tx, candidate),
			);
			reconciled += 1;
		} catch (error) {
			failed += 1;
			logger.error("Calendar delivery reconciliation failed", {
				...candidate,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return { candidates: candidates.length, reconciled, failed };
}
