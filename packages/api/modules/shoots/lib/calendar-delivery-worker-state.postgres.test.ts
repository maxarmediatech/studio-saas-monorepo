import { describe, expect, it } from "vitest";

describe("calendar worker cancellation PostgreSQL assertions", () => {
	it("exports the scenario invoked by the migrated baseline suite", () => {
		expect(assertCancellationFailureState).toBeTypeOf("function");
	});
});

// biome-ignore lint/suspicious/noExportsInTest: baseline suite imports this executable assertion.
export async function expectWrappedProducerFailure(
	operation: Promise<unknown>,
) {
	const failure = await operation.catch((error: unknown) => error);
	expect(failure).toBeInstanceOf(Error);
	expect((failure as Error & { cause?: Error }).cause?.message).toContain(
		"injected calendar producer failure",
	);
}

// biome-ignore lint/suspicious/noExportsInTest: shared PostgreSQL fixture ids.
export function makeCalendarIds(suffix: string) {
	return {
		google: `calendar_google_${suffix}`,
		registeredIcs: `calendar_registered_ics_${suffix}`,
		externalIcs: `calendar_external_ics_${suffix}`,
		unsendable: `calendar_unsendable_${suffix}`,
		failed: `calendar_failed_${suffix}`,
		retry: `calendar_retry_${suffix}`,
		missing: `calendar_missing_${suffix}`,
		pending: `calendar_pending_${suffix}`,
	};
}

// biome-ignore lint/suspicious/noExportsInTest: baseline suite imports this executable scenario.
export async function assertCancellationFailureState(ctx: any) {
	const {
		and,
		calendarSyncJobs,
		db,
		eq,
		expect,
		id,
		organizationId,
		processJob,
		shootCalendarEvents,
	} = ctx;
	const currentMapping = await db.query.shootCalendarEvents.findFirst({
		where: and(
			eq(shootCalendarEvents.organizationId, organizationId),
			eq(shootCalendarEvents.shootId, id),
		),
	});
	const [job] = await db
		.select()
		.from(calendarSyncJobs)
		.where(
			and(
				eq(calendarSyncJobs.organizationId, organizationId),
				eq(calendarSyncJobs.shootId, id),
				eq(calendarSyncJobs.jobType, "ics_send_cancel"),
				eq(
					calendarSyncJobs.generation,
					currentMapping?.intentGeneration ?? -1,
				),
			),
		);
	if (!job) {
		throw new Error("Expected cancellation job");
	}
	const claimToken = `cancel-failure-${id}`;
	const brokenPayload = {
		...(job.payload as any),
		target: { ...(job.payload as any).target, recipientEmail: null },
	};
	const [claimed] = await db
		.update(calendarSyncJobs)
		.set({
			status: "processing",
			attempts: 1,
			maxAttempts: 1,
			claimToken,
			lockedAt: new Date(),
			payload: brokenPayload,
		})
		.where(eq(calendarSyncJobs.id, job.id))
		.returning();
	await processJob(claimed);
	const mapping = await db.query.shootCalendarEvents.findFirst({
		where: and(
			eq(shootCalendarEvents.organizationId, organizationId),
			eq(shootCalendarEvents.shootId, id),
		),
	});
	expect(mapping).toMatchObject({
		syncStatus: "error",
		cancellationSyncStatus: "manual_reconciliation",
	});
	const failed = await db.query.calendarSyncJobs.findFirst({
		where: eq(calendarSyncJobs.id, job.id),
	});
	expect(failed).toMatchObject({
		status: "failed",
		effectState: "manual_reconciliation",
		nextAttemptAt: null,
	});
}

// biome-ignore lint/suspicious/noExportsInTest: baseline suite imports this executable scenario.
export async function assertAmbiguousCompensationRecovery(ctx: any) {
	const {
		and,
		calendarSyncJobs,
		db,
		eq,
		expect,
		id,
		mailBarrier,
		processJob,
		recoverStaleProcessingJobs,
		shootCalendarEvents,
	} = ctx;
	const candidates = await db
		.select()
		.from(calendarSyncJobs)
		.where(eq(calendarSyncJobs.shootId, id));
	const source = candidates.find(
		(job: any) =>
			job.payload?.operation === "delivery" &&
			job.payload?.target?.deliveryMethod === "ics",
	);
	if (!source) {
		throw new Error("Expected a completed provider result to compensate");
	}
	const firstToken = `compensation-crash-${id}`;
	const [firstClaim] = await db
		.update(calendarSyncJobs)
		.set({
			status: "processing",
			effectState: "compensating",
			providerResult: { googleEventId: null },
			claimToken: firstToken,
			lockedAt: new Date(),
			attempts: 1,
			maxAttempts: 3,
		})
		.where(eq(calendarSyncJobs.id, source.id))
		.returning();
	const callsBeforeCompensation = mailBarrier.calls.length;
	let inFlight: Promise<void> | undefined;
	try {
		mailBarrier.block();
		inFlight = processJob(firstClaim);
		await mailBarrier.waitForCalls(callsBeforeCompensation + 1);
		expect(
			await db.query.calendarSyncJobs.findFirst({
				where: eq(calendarSyncJobs.id, source.id),
			}),
		).toMatchObject({
			status: "processing",
			effectState: "compensation_dispatching",
			compensationSequence: expect.any(Number),
		});
		await db
			.update(calendarSyncJobs)
			.set({
				claimToken: `compensation-crashed-${id}`,
				lockedAt: new Date(Date.now() - 20 * 60 * 1000),
			})
			.where(eq(calendarSyncJobs.id, source.id));
		mailBarrier.release();
		await inFlight;
	} finally {
		mailBarrier.release();
		await inFlight;
	}
	expect(mailBarrier.calls).toHaveLength(callsBeforeCompensation + 1);
	await recoverStaleProcessingJobs();
	const quarantined = await db.query.calendarSyncJobs.findFirst({
		where: eq(calendarSyncJobs.id, source.id),
	});
	expect(quarantined).toMatchObject({
		status: "failed",
		effectState: "provider_outcome_uncertain",
		nextAttemptAt: null,
		claimToken: null,
		lastError:
			"Recovered ambiguous ICS compensation dispatch after worker termination",
		compensationSequence: expect.any(Number),
	});
	expect(
		await db.query.shootCalendarEvents.findFirst({
			where: and(
				eq(shootCalendarEvents.shootId, source.shootId),
				eq(shootCalendarEvents.crewId, source.crewId),
			),
		}),
	).toMatchObject({
		deliverySyncStatus: "manual_reconciliation",
		cancellationSyncStatus: "manual_reconciliation",
	});
	await recoverStaleProcessingJobs();
	expect(mailBarrier.calls).toHaveLength(callsBeforeCompensation + 1);
}
