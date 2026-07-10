import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
	and,
	calendarDeliveryIntents,
	calendarSyncJobs,
	db,
	eq,
	shootCalendarEvents,
	sql,
} from "@repo/database";
import { logger } from "@repo/logs";
import { revokeCleanedUpConnections } from "./connection-cleanup";
import { claimCalendarJobBatch, recoverStaleCalendarJobs } from "./job-claims";
import { cancellationIsCurrent, deliveryIsCurrent } from "./mapping-current";
import {
	compensateStaleEffect,
	performProviderEffect,
	type Snapshot,
} from "./provider-effects";
import {
	computeNextAttemptAfterFailure,
	DEFAULT_MAX_ATTEMPTS,
} from "./queue-helpers";

const pollIntervalMs = Number(process.env.CALENDAR_WORKER_INTERVAL_MS ?? 5000);
const batchSize = Number(process.env.CALENDAR_WORKER_BATCH_SIZE ?? 10);
const staleThresholdMinutesRaw = Number(
	process.env.CALENDAR_WORKER_STALE_THRESHOLD_MINUTES ?? 15,
);
const staleThresholdMinutes =
	Number.isFinite(staleThresholdMinutesRaw) && staleThresholdMinutesRaw > 0
		? staleThresholdMinutesRaw
		: 15;

function getSnapshot(job: typeof calendarSyncJobs.$inferSelect): Snapshot {
	if (!job.payload || typeof job.payload !== "object") {
		throw new Error(
			"Calendar job is missing its immutable intent snapshot",
		);
	}
	return job.payload as Snapshot;
}

function claimWhere(job: typeof calendarSyncJobs.$inferSelect) {
	if (!job.claimToken) {
		throw new Error("Processing job has no claim token");
	}
	return and(
		eq(calendarSyncJobs.id, job.id),
		eq(calendarSyncJobs.generation, job.generation),
		eq(calendarSyncJobs.status, "processing"),
		eq(calendarSyncJobs.claimToken, job.claimToken),
	);
}

export const claimJobBatch = () => claimCalendarJobBatch(batchSize);
export const recoverStaleProcessingJobs = () =>
	recoverStaleCalendarJobs(staleThresholdMinutes);

async function completeClaim(job: typeof calendarSyncJobs.$inferSelect) {
	return db
		.update(calendarSyncJobs)
		.set({
			status: "completed",
			effectState: "completed",
			nextAttemptAt: null,
			lastError: null,
			lockedAt: null,
			claimToken: null,
			updatedAt: new Date(),
		})
		.where(claimWhere(job))
		.returning({ id: calendarSyncJobs.id });
}

async function recordSuccess(
	job: typeof calendarSyncJobs.$inferSelect,
	snapshot: Snapshot,
	googleEventId: string | null,
) {
	return db.transaction((tx) =>
		transitionSuccess(tx, job, snapshot, googleEventId),
	);
}

async function transitionSuccess(
	tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
	job: typeof calendarSyncJobs.$inferSelect,
	snapshot: Snapshot,
	googleEventId: string | null,
) {
	let mappingUpdated = true;
	if (snapshot.operation === "delivery") {
		const updated = await tx
			.update(shootCalendarEvents)
			.set({
				deliveryMethod: snapshot.target.deliveryMethod,
				recipientEmail: snapshot.target.recipientEmail,
				calendarId:
					snapshot.target.deliveryMethod === "google"
						? "primary"
						: null,
				googleEventId,
				icalUid: snapshot.target.icalUid,
				icalSequence: snapshot.target.icalSequence,
				deliveredGeneration: job.generation,
				deliveredDeliveryMethod: snapshot.target.deliveryMethod,
				deliveredRecipientEmail: snapshot.target.recipientEmail,
				deliveredCalendarId:
					snapshot.target.deliveryMethod === "google"
						? "primary"
						: null,
				deliveredGoogleEventId: googleEventId,
				deliveredIcalUid: snapshot.target.icalUid,
				deliveredIcalSequence: snapshot.target.icalSequence,
				syncStatus: sql`CASE
						WHEN ${shootCalendarEvents.cancellationSyncStatus} = 'error' THEN 'error'::calendar_event_sync_status
						WHEN ${shootCalendarEvents.cancellationSyncStatus} = 'pending' THEN 'pending'::calendar_event_sync_status
						ELSE 'synced'::calendar_event_sync_status
					END`,
				lastSyncedAt: new Date(),
				lastError: null,
				deliverySyncStatus: "synced",
				deliveryLastError: null,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(shootCalendarEvents.organizationId, job.organizationId),
					eq(shootCalendarEvents.shootId, job.shootId ?? ""),
					eq(shootCalendarEvents.crewId, job.crewId ?? ""),
					eq(shootCalendarEvents.intentGeneration, job.generation),
					eq(shootCalendarEvents.intentState, "active"),
				),
			)
			.returning({ id: shootCalendarEvents.id });
		mappingUpdated = updated.length === 1;
	}
	if (snapshot.intentState === "cancelled") {
		const updated = await tx
			.update(shootCalendarEvents)
			.set({
				syncStatus: "deleted",
				lastSyncedAt: new Date(),
				lastError: null,
				cancellationSyncStatus: "synced",
				cancellationLastError: null,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(shootCalendarEvents.organizationId, job.organizationId),
					eq(shootCalendarEvents.shootId, job.shootId ?? ""),
					eq(shootCalendarEvents.crewId, job.crewId ?? ""),
					eq(shootCalendarEvents.intentGeneration, job.generation),
					eq(shootCalendarEvents.intentState, "cancelled"),
				),
			)
			.returning({ id: shootCalendarEvents.id });
		mappingUpdated = updated.length === 1;
	} else if (snapshot.operation === "cancellation") {
		const updated = await tx
			.update(shootCalendarEvents)
			.set({
				cancellationSyncStatus: "synced",
				cancellationLastError: null,
				syncStatus: sql`CASE
						WHEN ${shootCalendarEvents.deliverySyncStatus} = 'error' THEN 'error'::calendar_event_sync_status
						WHEN ${shootCalendarEvents.deliverySyncStatus} = 'pending' THEN 'pending'::calendar_event_sync_status
						ELSE 'synced'::calendar_event_sync_status
					END`,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(shootCalendarEvents.organizationId, job.organizationId),
					eq(shootCalendarEvents.shootId, job.shootId ?? ""),
					eq(shootCalendarEvents.crewId, job.crewId ?? ""),
					eq(shootCalendarEvents.intentGeneration, job.generation),
				),
			)
			.returning({ id: shootCalendarEvents.id });
		mappingUpdated = updated.length === 1;
	}
	if (!mappingUpdated) {
		return false;
	}
	const consumed = await tx
		.update(calendarSyncJobs)
		.set({
			status: "completed",
			effectState: "completed",
			nextAttemptAt: null,
			lastError: null,
			lockedAt: null,
			claimToken: null,
			updatedAt: new Date(),
		})
		.where(claimWhere(job))
		.returning({ id: calendarSyncJobs.id });
	if (consumed.length !== 1) {
		throw new Error("Calendar claim lost during mapping transition");
	}
	return true;
}

async function performAndPersistProviderEffect(
	job: typeof calendarSyncJobs.$inferSelect,
	snapshot: Snapshot,
) {
	return db.transaction(async (tx) => {
		await tx.execute(
			sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${job.organizationId}:${job.shootId}:${job.crewId}`}, 0))`,
		);
		const claimed = await tx.execute(sql`
			SELECT id FROM ${calendarSyncJobs}
			WHERE id = ${job.id}
				AND generation = ${job.generation}
				AND status = 'processing'
				AND claim_token = ${job.claimToken}
			FOR UPDATE
		`);
		if (claimed.rows.length !== 1) {
			return null;
		}
		const mapping = await tx.query.shootCalendarEvents.findFirst({
			where: and(
				eq(shootCalendarEvents.organizationId, job.organizationId),
				eq(shootCalendarEvents.shootId, job.shootId ?? ""),
				eq(shootCalendarEvents.crewId, job.crewId ?? ""),
			),
		});
		const current =
			mapping?.intentGeneration === job.generation &&
			(snapshot.operation === "delivery"
				? mapping.intentState === "active"
				: mapping.intentState === "cancelled" ||
					mapping.deliveryMethod !== snapshot.target.deliveryMethod ||
					mapping.recipientEmail !== snapshot.target.recipientEmail);
		if (!current) {
			return null;
		}
		const result = await performProviderEffect(job, snapshot);
		const persisted = await tx
			.update(calendarSyncJobs)
			.set({
				effectState: "provider_applied",
				providerResult: result,
				lockedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(claimWhere(job))
			.returning({ id: calendarSyncJobs.id });
		if (persisted.length !== 1) {
			throw new Error(
				"Calendar claim lost while persisting provider result",
			);
		}
		const recorded = await transitionSuccess(
			tx,
			job,
			snapshot,
			result.googleEventId,
		);
		return { result, recorded };
	});
}

async function markCompensating(job: typeof calendarSyncJobs.$inferSelect) {
	await db
		.update(calendarSyncJobs)
		.set({
			status: "failed",
			effectState: "compensating",
			nextAttemptAt: new Date(),
			lockedAt: null,
			claimToken: null,
			lastError: "Provider effect requires compensation",
			updatedAt: new Date(),
		})
		.where(claimWhere(job));
}

async function getCompensationSequence(
	job: typeof calendarSyncJobs.$inferSelect,
) {
	if (job.compensationSequence != null) {
		return job.compensationSequence;
	}
	return db.transaction(async (tx) => {
		await tx.execute(
			sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${job.organizationId}:${job.shootId}:${job.crewId}`}, 0))`,
		);
		const result = await tx.execute(sql`
			SELECT GREATEST(
				COALESCE((SELECT MAX(ical_sequence) FROM ${calendarDeliveryIntents}
					WHERE organization_id = ${job.organizationId} AND shoot_id = ${job.shootId} AND crew_id = ${job.crewId}), -1),
				COALESCE((SELECT MAX(compensation_sequence) FROM ${calendarSyncJobs}
					WHERE organization_id = ${job.organizationId} AND shoot_id = ${job.shootId} AND crew_id = ${job.crewId}), -1)
			) + 1 AS sequence
		`);
		const sequence = Number(
			(result.rows[0] as { sequence: number }).sequence,
		);
		await tx
			.update(calendarSyncJobs)
			.set({ compensationSequence: sequence })
			.where(eq(calendarSyncJobs.id, job.id));
		return sequence;
	});
}

async function recordFailure(
	job: typeof calendarSyncJobs.$inferSelect,
	snapshot: Snapshot | null,
	errorMessage: string,
) {
	const nextAttemptAt = computeNextAttemptAfterFailure({
		attempts: job.attempts ?? 0,
		maxAttempts: job.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
	});
	await db.transaction(async (tx) => {
		const failed = await tx
			.update(calendarSyncJobs)
			.set({
				status: "failed",
				nextAttemptAt,
				lastError: errorMessage,
				lockedAt: null,
				claimToken: null,
				updatedAt: new Date(),
			})
			.where(claimWhere(job))
			.returning({ id: calendarSyncJobs.id });
		if (failed.length !== 1 || !snapshot) {
			return;
		}
		const current =
			snapshot.operation === "cancellation"
				? await cancellationIsCurrent(job, snapshot)
				: await deliveryIsCurrent(job);
		if (!current) {
			return;
		}
		await tx
			.update(shootCalendarEvents)
			.set({
				syncStatus: "error",
				lastError: errorMessage,
				...(snapshot.operation === "cancellation"
					? {
							cancellationSyncStatus: "error",
							cancellationLastError: errorMessage,
						}
					: {
							deliverySyncStatus: "error",
							deliveryLastError: errorMessage,
						}),
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(shootCalendarEvents.organizationId, job.organizationId),
					eq(shootCalendarEvents.shootId, job.shootId ?? ""),
					eq(shootCalendarEvents.crewId, job.crewId ?? ""),
					eq(shootCalendarEvents.intentGeneration, job.generation),
				),
			);
	});
}

export async function processJob(job: typeof calendarSyncJobs.$inferSelect) {
	let snapshot: Snapshot | null = null;
	try {
		if (!job.shootId || !job.crewId) {
			throw new Error("Job missing shootId/crewId");
		}
		snapshot = getSnapshot(job);
		if (job.effectState === "compensating") {
			const result = (job.providerResult ?? {}) as {
				googleEventId?: string | null;
			};
			const sequence =
				snapshot.target.deliveryMethod === "ics"
					? await getCompensationSequence(job)
					: null;
			await compensateStaleEffect(
				job,
				snapshot,
				result.googleEventId ?? null,
				sequence,
			);
			await completeClaim(job);
			return;
		}
		const current =
			snapshot.operation === "cancellation"
				? await cancellationIsCurrent(job, snapshot)
				: await deliveryIsCurrent(job);
		if (!current) {
			await completeClaim(job);
			return;
		}
		const persistedResult = job.providerResult as {
			googleEventId?: string | null;
		} | null;
		const applied =
			job.effectState === "provider_applied" && persistedResult
				? null
				: await performAndPersistProviderEffect(job, snapshot);
		if (job.effectState !== "provider_applied") {
			if (!applied) {
				await completeClaim(job);
				return;
			}
			if (!applied.recorded) {
				await markCompensating(job);
			}
			return;
		}
		if (!persistedResult) {
			await completeClaim(job);
			return;
		}
		const result = { googleEventId: persistedResult.googleEventId ?? null };
		const stillCurrent =
			snapshot.operation === "cancellation"
				? await cancellationIsCurrent(job, snapshot)
				: await deliveryIsCurrent(job);
		if (!stillCurrent) {
			await markCompensating(job);
			return;
		}
		const recorded = await recordSuccess(
			job,
			snapshot,
			result.googleEventId,
		);
		if (!recorded) {
			await markCompensating(job);
		}
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : String(error);
		logger.error("Calendar job failed", {
			jobId: job.id,
			jobType: job.jobType,
			generation: job.generation,
			error: errorMessage,
		});
		await recordFailure(job, snapshot, errorMessage);
	}
}

async function loop() {
	await recoverStaleProcessingJobs();
	for (const job of await claimJobBatch()) {
		await processJob(job);
	}
	await revokeCleanedUpConnections();
}

async function main() {
	logger.info("Calendar worker started", {
		pollIntervalMs,
		batchSize,
		staleThresholdMinutes,
	});
	while (true) {
		try {
			await loop();
		} catch (error) {
			logger.error("Calendar worker loop failed", {
				error: error instanceof Error ? error.message : String(error),
			});
		}
		await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
	}
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
	void main();
}
