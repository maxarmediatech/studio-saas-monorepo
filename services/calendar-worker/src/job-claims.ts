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
				(${calendarSyncJobs.status} = 'pending'
					AND ${calendarSyncJobs.effectState} = 'pending')
				OR (${calendarSyncJobs.status} = 'failed'
					AND (
						${calendarSyncJobs.effectState} = 'provider_applied'
						OR (${calendarSyncJobs.effectState} IN ('pending', 'compensating')
							AND COALESCE(${calendarSyncJobs.attempts}, 0) < COALESCE(${calendarSyncJobs.maxAttempts}, ${DEFAULT_MAX_ATTEMPTS}))
					))
			)
			AND (${calendarSyncJobs.nextAttemptAt} IS NULL OR ${calendarSyncJobs.nextAttemptAt} <= ${now})
			AND (
				job_type IN ('google_delete', 'ics_send_cancel')
				OR (
					NOT EXISTS (
						SELECT 1 FROM calendar_sync_jobs AS cancellation_job
						WHERE cancellation_job.organization_id = calendar_sync_jobs.organization_id
							AND cancellation_job.shoot_id = calendar_sync_jobs.shoot_id
							AND cancellation_job.crew_id = calendar_sync_jobs.crew_id
							AND cancellation_job.job_type IN ('google_delete', 'ics_send_cancel')
							AND cancellation_job.status <> 'completed'
					)
					AND NOT EXISTS (
						SELECT 1 FROM shoot_calendar_events AS mapping
						WHERE mapping.organization_id = calendar_sync_jobs.organization_id
							AND mapping.shoot_id = calendar_sync_jobs.shoot_id
							AND mapping.crew_id = calendar_sync_jobs.crew_id
							AND mapping.cancellation_sync_status IN ('pending', 'error', 'manual_reconciliation')
					)
				)
			)
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
				nextAttemptAt: sql`CASE
					WHEN ${calendarSyncJobs.effectState} = 'provider_applied' THEN NOW()
					WHEN ${calendarSyncJobs.effectState} IN ('dispatching', 'compensation_dispatching') THEN NULL
					WHEN COALESCE(${calendarSyncJobs.attempts}, 0) < COALESCE(${calendarSyncJobs.maxAttempts}, ${DEFAULT_MAX_ATTEMPTS}) THEN NOW()
					ELSE NULL
				END`,
				lastError: sql`CASE
					WHEN ${calendarSyncJobs.effectState} = 'compensation_dispatching'
						THEN 'Recovered ambiguous ICS compensation dispatch after worker termination'
					WHEN ${calendarSyncJobs.effectState} = 'dispatching'
						THEN 'Recovered ambiguous ICS provider dispatch after worker termination'
					ELSE 'Recovered stale processing lock'
				END`,
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
				job.effectState === "dispatching" ||
				job.effectState === "compensation_dispatching"
			) {
				const compensation =
					job.effectState === "compensation_dispatching";
				const snapshot = job.payload as Snapshot | null;
				const errorMessage =
					job.lastError ??
					(compensation
						? "Recovered ambiguous ICS compensation dispatch after worker termination"
						: "Recovered ambiguous ICS provider dispatch after worker termination");
				await tx
					.update(calendarSyncJobs)
					.set({ effectState: "provider_outcome_uncertain" })
					.where(eq(calendarSyncJobs.id, job.id));
				await tx
					.update(shootCalendarEvents)
					.set({
						syncStatus: "error",
						lastError: errorMessage,
						...(snapshot?.operation === "cancellation" &&
						!compensation
							? {
									cancellationSyncStatus:
										"manual_reconciliation",
									cancellationLastError: errorMessage,
								}
							: {
									deliverySyncStatus: "manual_reconciliation",
									deliveryLastError: errorMessage,
									cancellationSyncStatus:
										"manual_reconciliation",
									cancellationLastError: errorMessage,
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
						),
					);
				continue;
			}
			if (job.effectState === "provider_applied") {
				// The provider result is already durable. Reclaim this job even when
				// its provider-attempt budget is exhausted so processJob can finish
				// only the local mapping transition.
				continue;
			}
			if (
				(job.attempts ?? 0) < (job.maxAttempts ?? DEFAULT_MAX_ATTEMPTS)
			) {
				continue;
			}
			const cancellation =
				(job.payload as Snapshot | null)?.operation === "cancellation";
			if (cancellation) {
				await tx
					.update(calendarSyncJobs)
					.set({ effectState: "manual_reconciliation" })
					.where(eq(calendarSyncJobs.id, job.id));
			}
			await tx
				.update(shootCalendarEvents)
				.set({
					syncStatus: "error",
					lastError: "Calendar worker lease exhausted",
					...(cancellation
						? {
								cancellationSyncStatus: "manual_reconciliation",
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
						cancellation
							? undefined
							: eq(
									shootCalendarEvents.intentGeneration,
									job.generation,
								),
					),
				);
		}
		return recovered.map(({ id }) => ({ id }));
	});
}
