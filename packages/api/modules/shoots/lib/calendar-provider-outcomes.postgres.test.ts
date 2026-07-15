import { describe, expect, it } from "vitest";

describe("calendar provider outcome PostgreSQL assertions", () => {
	it("exports the scenario invoked by the migrated baseline suite", () => {
		expect(assertProviderOutcomeRecovery).toBeTypeOf("function");
	});
});

// biome-ignore lint/suspicious/noExportsInTest: baseline suite imports this executable scenario.
export async function assertProviderOutcomeRecovery(ctx: any) {
	const {
		and,
		bookingId,
		calendarDeliveryIntents,
		calendarSyncJobs,
		claimJobBatch,
		crews,
		db,
		eq,
		expect,
		ids,
		mailBarrier,
		organizationId,
		processJob,
		recoverStaleProcessingJobs,
		route,
		shootAssignments,
		shootCalendarEvents,
		shoots,
		sql,
		suffix,
	} = ctx;

	const providerUncertainId = `calendar_provider_uncertain_${suffix}`;
	const providerAppliedId = `calendar_provider_applied_${suffix}`;
	await db.insert(crews).values(
		[providerUncertainId, providerAppliedId].map((id) => ({
			id,
			organizationId,
			name: id,
			email: `${id}@example.com`,
		})),
	);
	await db.insert(shoots).values(
		[providerUncertainId, providerAppliedId].map((id) => ({
			id,
			organizationId,
			bookingId,
			name: id,
			shootType: "wedding",
			shootDate: "2027-03-10",
			status: "scheduled",
		})),
	);
	await db.insert(shootAssignments).values(
		[providerUncertainId, providerAppliedId].map((id) => ({
			shootId: id,
			crewId: id,
			role: "Photographer",
		})),
	);
	const icsSource = await db.query.calendarDeliveryIntents.findFirst({
		where: and(
			eq(calendarDeliveryIntents.organizationId, organizationId),
			eq(calendarDeliveryIntents.shootId, ids.externalIcs),
		),
	});
	if (!icsSource) {
		throw new Error("Expected immutable ICS source intent");
	}
	const uncertainSnapshot = {
		...(icsSource.payload as any),
		operation: "delivery",
		intentState: "active",
		target: {
			...(icsSource.payload as any).target,
			deliveryMethod: "ics",
			recipientEmail: `${providerUncertainId}@example.com`,
			icalUid: `${providerUncertainId}@example.invalid`,
			icalSequence: 1,
		},
	};
	await db.insert(shootCalendarEvents).values({
		organizationId,
		shootId: providerUncertainId,
		crewId: providerUncertainId,
		deliveryMethod: "ics",
		recipientEmail: `${providerUncertainId}@example.com`,
		icalUid: `${providerUncertainId}@example.invalid`,
		icalSequence: 1,
		intentGeneration: 1,
		intentState: "active",
		syncStatus: "pending",
		deliverySyncStatus: "pending",
	});
	const [uncertainDeliveryJob] = await db
		.insert(calendarSyncJobs)
		.values({
			organizationId,
			deliveryKey: `calendar:${organizationId}:${providerUncertainId}:${providerUncertainId}:delivery:1`,
			status: "processing",
			jobType: "ics_send_invite",
			shootId: providerUncertainId,
			crewId: providerUncertainId,
			generation: 1,
			attempts: 1,
			maxAttempts: 1,
			claimToken: `uncertain-provider-${suffix}`,
			lockedAt: new Date(),
			payload: uncertainSnapshot,
		})
		.returning();
	const persistenceFunction = `calendar_provider_persist_${suffix}`;
	const persistenceTrigger = `${persistenceFunction}_trigger`;
	await db.execute(
		sql.raw(`CREATE FUNCTION "${persistenceFunction}"() RETURNS trigger AS $$
			BEGIN
				IF NEW.id = '${uncertainDeliveryJob.id}' AND NEW.effect_state = 'provider_applied' THEN
					RAISE EXCEPTION 'injected provider result persistence failure';
				END IF;
				RETURN NEW;
			END;
		$$ LANGUAGE plpgsql`),
	);
	await db.execute(
		sql.raw(`CREATE TRIGGER "${persistenceTrigger}" BEFORE UPDATE
			ON calendar_sync_jobs FOR EACH ROW EXECUTE FUNCTION "${persistenceFunction}"()`),
	);
	const callsBeforeUncertainDelivery = mailBarrier.calls.length;
	try {
		await processJob(uncertainDeliveryJob);
	} finally {
		await db.execute(
			sql.raw(
				`DROP TRIGGER IF EXISTS "${persistenceTrigger}" ON calendar_sync_jobs`,
			),
		);
		await db.execute(
			sql.raw(`DROP FUNCTION IF EXISTS "${persistenceFunction}"()`),
		);
	}
	expect(mailBarrier.calls).toHaveLength(callsBeforeUncertainDelivery + 1);
	expect(
		await db.query.calendarSyncJobs.findFirst({
			where: eq(calendarSyncJobs.id, uncertainDeliveryJob.id),
		}),
	).toMatchObject({
		status: "failed",
		effectState: "provider_outcome_uncertain",
		nextAttemptAt: null,
		lastError: expect.stringContaining(
			"provider succeeded but its result was not durably recorded",
		),
	});
	expect(
		await db.query.shootCalendarEvents.findFirst({
			where: eq(shootCalendarEvents.shootId, providerUncertainId),
		}),
	).toMatchObject({
		deliverySyncStatus: "manual_reconciliation",
		cancellationSyncStatus: "manual_reconciliation",
	});
	const uncertainJobCount = (
		await db
			.select()
			.from(calendarSyncJobs)
			.where(eq(calendarSyncJobs.shootId, providerUncertainId))
	).length;
	await expect(route(providerUncertainId)).resolves.toMatchObject({
		state: "manual_reconciliation",
		jobType: null,
	});
	expect(
		await db
			.select()
			.from(calendarSyncJobs)
			.where(eq(calendarSyncJobs.shootId, providerUncertainId)),
	).toHaveLength(uncertainJobCount);

	const appliedCancellationSnapshot = {
		...uncertainSnapshot,
		operation: "cancellation",
		intentState: "cancelled",
		target: {
			...uncertainSnapshot.target,
			recipientEmail: `old-${providerAppliedId}@example.com`,
			icalUid: `old-${providerAppliedId}@example.invalid`,
			icalSequence: 2,
		},
	};
	await db.insert(shootCalendarEvents).values({
		organizationId,
		shootId: providerAppliedId,
		crewId: providerAppliedId,
		deliveryMethod: "ics",
		recipientEmail: `old-${providerAppliedId}@example.com`,
		icalUid: `old-${providerAppliedId}@example.invalid`,
		icalSequence: 2,
		intentGeneration: 1,
		intentState: "active",
		syncStatus: "pending",
		deliverySyncStatus: "synced",
		cancellationSyncStatus: "pending",
		deliveredGeneration: 0,
		deliveredDeliveryMethod: "ics",
		deliveredRecipientEmail: `old-${providerAppliedId}@example.com`,
		deliveredIcalUid: `old-${providerAppliedId}@example.invalid`,
		deliveredIcalSequence: 1,
	});
	const [providerAppliedJob] = await db
		.insert(calendarSyncJobs)
		.values({
			organizationId,
			deliveryKey: `calendar:${organizationId}:${providerAppliedId}:${providerAppliedId}:cancellation:1`,
			status: "processing",
			jobType: "ics_send_cancel",
			shootId: providerAppliedId,
			crewId: providerAppliedId,
			generation: 1,
			attempts: 1,
			maxAttempts: 1,
			claimToken: `provider-applied-${suffix}`,
			lockedAt: new Date(Date.now() - 20 * 60 * 1000),
			effectState: "provider_applied",
			providerResult: { googleEventId: null },
			payload: appliedCancellationSnapshot,
		})
		.returning();
	const callsBeforeProviderAppliedRecovery = mailBarrier.calls.length;
	await expect(route(providerAppliedId)).resolves.toMatchObject({
		jobType: "ics_send_invite",
		state: "queued",
	});
	expect(
		await db.query.shootCalendarEvents.findFirst({
			where: eq(shootCalendarEvents.shootId, providerAppliedId),
		}),
	).toMatchObject({
		intentGeneration: 2,
		intentState: "active",
		cancellationSyncStatus: "pending",
	});
	await recoverStaleProcessingJobs();
	expect(
		await db.query.calendarSyncJobs.findFirst({
			where: eq(calendarSyncJobs.id, providerAppliedJob.id),
		}),
	).toMatchObject({
		status: "failed",
		effectState: "provider_applied",
		nextAttemptAt: expect.any(Date),
	});
	const reclaimedProviderApplied = (await claimJobBatch()).find(
		(job: any) => job.id === providerAppliedJob.id,
	);
	if (!reclaimedProviderApplied) {
		throw new Error("Expected provider-applied job to be reclaimed");
	}
	await processJob(reclaimedProviderApplied);
	expect(mailBarrier.calls).toHaveLength(callsBeforeProviderAppliedRecovery);
	expect(
		await db.query.calendarSyncJobs.findFirst({
			where: eq(calendarSyncJobs.id, providerAppliedJob.id),
		}),
	).toMatchObject({ status: "completed", effectState: "completed" });
	expect(
		await db.query.shootCalendarEvents.findFirst({
			where: eq(shootCalendarEvents.shootId, providerAppliedId),
		}),
	).toMatchObject({
		intentGeneration: 2,
		intentState: "active",
		syncStatus: "pending",
		cancellationSyncStatus: "synced",
	});
}
