import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
	and,
	calendarSyncJobs,
	db,
	eq,
	isNotNull,
	lte,
	shootCalendarEvents,
	sql,
} from "@repo/database";
import { logger } from "@repo/logs";
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

export async function claimJobBatch() {
	const now = new Date();
	return db.transaction(async (tx) => {
		const claimable = await tx.execute(sql`
			SELECT id FROM ${calendarSyncJobs}
			WHERE (
				${calendarSyncJobs.status} = 'pending'
				OR (${calendarSyncJobs.status} = 'failed'
					AND COALESCE(${calendarSyncJobs.attempts}, 0) < COALESCE(${calendarSyncJobs.maxAttempts}, ${DEFAULT_MAX_ATTEMPTS}))
			)
			AND (${calendarSyncJobs.nextAttemptAt} IS NULL OR ${calendarSyncJobs.nextAttemptAt} <= ${now})
			ORDER BY ${calendarSyncJobs.createdAt} ASC
			LIMIT ${batchSize}
			FOR UPDATE SKIP LOCKED
		`);
		const ids = (claimable.rows as { id: string }[]).map((row) => row.id);
		if (ids.length === 0) {
			return [];
		}
		const claimed = await Promise.all(
			ids.map(async (id) => {
				const [job] = await tx
					.update(calendarSyncJobs)
					.set({
						status: "processing",
						attempts: sql`COALESCE(${calendarSyncJobs.attempts}, 0) + 1`,
						lastAttemptAt: now,
						lockedAt: now,
						claimToken: randomUUID(),
						updatedAt: now,
					})
					.where(eq(calendarSyncJobs.id, id))
					.returning();
				return job;
			}),
		);
		return claimed.filter(
			(job): job is typeof calendarSyncJobs.$inferSelect => Boolean(job),
		);
	});
}

export async function recoverStaleProcessingJobs() {
	const threshold = new Date(Date.now() - staleThresholdMinutes * 60 * 1000);
	return db
		.update(calendarSyncJobs)
		.set({
			status: "failed",
			nextAttemptAt: sql`CASE WHEN COALESCE(${calendarSyncJobs.attempts}, 0) < COALESCE(${calendarSyncJobs.maxAttempts}, ${DEFAULT_MAX_ATTEMPTS}) THEN NOW() ELSE NULL END`,
			lastError: "Recovered stale processing lock",
			lockedAt: null,
			claimToken: null,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(calendarSyncJobs.status, "processing"),
				isNotNull(calendarSyncJobs.lockedAt),
				lte(calendarSyncJobs.lockedAt, threshold),
			),
		)
		.returning({ id: calendarSyncJobs.id });
}

async function completeClaim(job: typeof calendarSyncJobs.$inferSelect) {
	return db
		.update(calendarSyncJobs)
		.set({
			status: "completed",
			nextAttemptAt: null,
			lastError: null,
			lockedAt: null,
			claimToken: null,
			updatedAt: new Date(),
		})
		.where(claimWhere(job))
		.returning({ id: calendarSyncJobs.id });
}

async function renewClaim(job: typeof calendarSyncJobs.$inferSelect) {
	const renewed = await db
		.update(calendarSyncJobs)
		.set({ lockedAt: new Date(), updatedAt: new Date() })
		.where(claimWhere(job))
		.returning({ id: calendarSyncJobs.id });
	return renewed.length === 1;
}

async function deliveryIsCurrent(job: typeof calendarSyncJobs.$inferSelect) {
	const mapping = await db.query.shootCalendarEvents.findFirst({
		where: and(
			eq(shootCalendarEvents.organizationId, job.organizationId),
			eq(shootCalendarEvents.shootId, job.shootId ?? ""),
			eq(shootCalendarEvents.crewId, job.crewId ?? ""),
		),
	});
	return (
		mapping?.intentGeneration === job.generation &&
		mapping.intentState === "active"
	);
}

async function cancellationIsCurrent(
	job: typeof calendarSyncJobs.$inferSelect,
	snapshot: Snapshot,
) {
	const mapping = await db.query.shootCalendarEvents.findFirst({
		where: and(
			eq(shootCalendarEvents.organizationId, job.organizationId),
			eq(shootCalendarEvents.shootId, job.shootId ?? ""),
			eq(shootCalendarEvents.crewId, job.crewId ?? ""),
		),
	});
	if (!mapping || mapping.intentGeneration !== job.generation) {
		return false;
	}
	if (mapping.intentState === "cancelled") {
		return true;
	}
	return (
		mapping.deliveryMethod !== snapshot.target.deliveryMethod ||
		mapping.recipientEmail !== snapshot.target.recipientEmail
	);
}

async function recordSuccess(
	job: typeof calendarSyncJobs.$inferSelect,
	snapshot: Snapshot,
	googleEventId: string | null,
) {
	return db.transaction(async (tx) => {
		const consumed = await tx
			.update(calendarSyncJobs)
			.set({
				status: "completed",
				nextAttemptAt: null,
				lastError: null,
				lockedAt: null,
				claimToken: null,
				updatedAt: new Date(),
			})
			.where(claimWhere(job))
			.returning({ id: calendarSyncJobs.id });
		if (consumed.length !== 1) {
			return false;
		}
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
					syncStatus: "synced",
					lastSyncedAt: new Date(),
					lastError: null,
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(
							shootCalendarEvents.organizationId,
							job.organizationId,
						),
						eq(shootCalendarEvents.shootId, job.shootId ?? ""),
						eq(shootCalendarEvents.crewId, job.crewId ?? ""),
						eq(
							shootCalendarEvents.intentGeneration,
							job.generation,
						),
						eq(shootCalendarEvents.intentState, "active"),
					),
				)
				.returning({ id: shootCalendarEvents.id });
			return updated.length === 1;
		}
		if (snapshot.intentState === "cancelled") {
			const updated = await tx
				.update(shootCalendarEvents)
				.set({
					syncStatus: "deleted",
					lastSyncedAt: new Date(),
					lastError: null,
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(
							shootCalendarEvents.organizationId,
							job.organizationId,
						),
						eq(shootCalendarEvents.shootId, job.shootId ?? ""),
						eq(shootCalendarEvents.crewId, job.crewId ?? ""),
						eq(
							shootCalendarEvents.intentGeneration,
							job.generation,
						),
						eq(shootCalendarEvents.intentState, "cancelled"),
					),
				)
				.returning({ id: shootCalendarEvents.id });
			return updated.length === 1;
		}
		return true;
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
		const current =
			snapshot.operation === "cancellation"
				? await cancellationIsCurrent(job, snapshot)
				: await deliveryIsCurrent(job);
		if (!current) {
			await completeClaim(job);
			return;
		}
		if (!(await renewClaim(job))) {
			return;
		}
		const result = await performProviderEffect(job, snapshot);
		const stillCurrent =
			snapshot.operation === "cancellation"
				? await cancellationIsCurrent(job, snapshot)
				: await deliveryIsCurrent(job);
		if (!stillCurrent) {
			await compensateStaleEffect(job, snapshot, result.googleEventId);
			await completeClaim(job);
			return;
		}
		const recorded = await recordSuccess(
			job,
			snapshot,
			result.googleEventId,
		);
		if (!recorded) {
			await compensateStaleEffect(job, snapshot, result.googleEventId);
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
