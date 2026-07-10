import { randomUUID } from "node:crypto";
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
import type { Snapshot } from "./provider-effects";
import { DEFAULT_MAX_ATTEMPTS } from "./queue-helpers";

export async function claimCalendarJobBatch(batchSize: number) {
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
		return Promise.all(
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
	});
}

export async function recoverStaleCalendarJobs(staleThresholdMinutes: number) {
	const threshold = new Date(Date.now() - staleThresholdMinutes * 60 * 1000);
	return db.transaction(async (tx) => {
		const recovered = await tx
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
			.returning();
		for (const job of recovered) {
			if (
				(job.attempts ?? 0) < (job.maxAttempts ?? DEFAULT_MAX_ATTEMPTS)
			) {
				continue;
			}
			const cancellation =
				(job.payload as Snapshot | null)?.operation === "cancellation";
			await tx
				.update(shootCalendarEvents)
				.set({
					syncStatus: "error",
					lastError: "Calendar worker lease exhausted",
					...(cancellation
						? {
								cancellationSyncStatus: "error",
								cancellationLastError:
									"Calendar worker lease exhausted",
							}
						: {
								deliverySyncStatus: "error",
								deliveryLastError:
									"Calendar worker lease exhausted",
							}),
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
					),
				);
		}
		return recovered.map(({ id }) => ({ id }));
	});
}
