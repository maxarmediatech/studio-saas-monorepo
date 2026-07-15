import { describe, expect, it } from "vitest";
import { assertProviderOutcomeRecovery } from "./calendar-provider-outcomes.postgres.test";

describe("calendar cancellation convergence PostgreSQL assertions", () => {
	it("exports the scenario invoked by the migrated baseline suite", () => {
		expect(assertLegacyCancellationConvergence).toBeTypeOf("function");
	});
});

// biome-ignore lint/suspicious/noExportsInTest: baseline suite imports this executable scenario.
export async function assertLegacyCancellationConvergence(ctx: any) {
	const {
		and,
		bookingId,
		calendarDeliveryIntents,
		calendarSyncJobs,
		crews,
		db,
		eq,
		expect,
		ids,
		mailBarrier,
		organizationId,
		processJob,
		recoverStaleProcessingJobs,
		reconcileCalendarDeliveries,
		shootCalendarEvents,
		shoots,
		suffix,
	} = ctx;
	const legacyIds = {
		noEffect: `calendar_legacy_no_effect_${suffix}`,
		ics: `calendar_legacy_ics_${suffix}`,
		google: `calendar_legacy_google_${suffix}`,
		manual: `calendar_legacy_manual_${suffix}`,
		uncertain: `calendar_legacy_uncertain_${suffix}`,
	};
	await db.insert(crews).values(
		Object.values(legacyIds).map((id) => ({
			id,
			organizationId,
			name: id,
			email: `${id}@example.com`,
		})),
	);
	await db.insert(shoots).values(
		Object.values(legacyIds).map((id) => ({
			id,
			organizationId,
			bookingId,
			name: `Legacy cleanup ${id}`,
			shootType: "wedding",
			shootDate: "2027-01-15",
			startTime: "10:00",
			status: "scheduled",
		})),
	);

	const googleSource = await db.query.calendarDeliveryIntents.findFirst({
		where: and(
			eq(calendarDeliveryIntents.organizationId, organizationId),
			eq(calendarDeliveryIntents.shootId, ids.google),
		),
	});
	if (!googleSource) {
		throw new Error("Expected immutable Google source intent");
	}
	const googlePayload = {
		...(googleSource.payload as any),
		target: {
			...(googleSource.payload as any).target,
			calendarId: "legacy-primary",
			googleEventId: `legacy-event-${suffix}`,
		},
	};
	await db.insert(calendarDeliveryIntents).values({
		organizationId,
		shootId: legacyIds.google,
		crewId: legacyIds.google,
		generation: 1,
		state: "active",
		deliveryMethod: "google",
		calendarId: "legacy-primary",
		googleEventId: `legacy-event-${suffix}`,
		googleConnectionId: googleSource.googleConnectionId,
		googleAccountEmail: googleSource.googleAccountEmail,
		payload: googlePayload,
	});

	await db.insert(shootCalendarEvents).values([
		{
			organizationId,
			shootId: legacyIds.noEffect,
			crewId: legacyIds.noEffect,
			deliveryMethod: "ics",
			intentGeneration: 0,
			syncStatus: "pending",
		},
		{
			organizationId,
			shootId: legacyIds.ics,
			crewId: legacyIds.ics,
			deliveryMethod: "ics",
			recipientEmail: `current-${suffix}@example.com`,
			icalUid: `current-${suffix}@example.invalid`,
			icalSequence: 5,
			intentGeneration: 1,
			syncStatus: "synced",
			deliverySyncStatus: "synced",
			deliveredGeneration: 1,
			deliveredDeliveryMethod: "ics",
			deliveredRecipientEmail: `delivered-${suffix}@example.com`,
			deliveredIcalUid: `delivered-${suffix}@example.invalid`,
			deliveredIcalSequence: 5,
		},
		{
			organizationId,
			shootId: legacyIds.google,
			crewId: legacyIds.google,
			deliveryMethod: "google",
			calendarId: "legacy-primary",
			googleEventId: `legacy-event-${suffix}`,
			intentGeneration: 1,
			syncStatus: "synced",
			deliverySyncStatus: "synced",
			deliveredGeneration: 1,
			deliveredDeliveryMethod: "google",
			deliveredCalendarId: "legacy-primary",
			deliveredGoogleEventId: `legacy-event-${suffix}`,
		},
		{
			organizationId,
			shootId: legacyIds.manual,
			crewId: legacyIds.manual,
			deliveryMethod: "google",
			googleEventId: `orphan-event-${suffix}`,
			intentGeneration: 1,
			syncStatus: "synced",
			deliverySyncStatus: "synced",
			deliveredGeneration: 1,
			deliveredDeliveryMethod: "google",
			deliveredGoogleEventId: `orphan-event-${suffix}`,
		},
	]);

	const first = await reconcileCalendarDeliveries({
		organizationId,
		apply: true,
	});
	// Existing active quarantines remain visible to reconciliation instead of
	// being reported as successfully replaced.
	expect(first.failed).toBeGreaterThanOrEqual(2);
	const mappings = await Promise.all(
		Object.values(legacyIds).map((shootId) =>
			db.query.shootCalendarEvents.findFirst({
				where: and(
					eq(shootCalendarEvents.organizationId, organizationId),
					eq(shootCalendarEvents.shootId, shootId),
				),
			}),
		),
	);
	expect(mappings[0]).toMatchObject({
		intentState: "cancelled",
		syncStatus: "deleted",
		cancellationSyncStatus: "synced",
		cancellationLastError: expect.stringContaining("No evidence"),
	});
	expect(mappings[3]).toMatchObject({
		intentState: "cancelled",
		syncStatus: "error",
		cancellationSyncStatus: "manual_reconciliation",
		cancellationLastError: expect.stringContaining(
			"lacks provable immutable",
		),
	});

	const jobs = await db
		.select()
		.from(calendarSyncJobs)
		.where(eq(calendarSyncJobs.organizationId, organizationId));
	const legacyJobs = jobs.filter((job: any) =>
		Object.values(legacyIds).includes(job.shootId),
	);
	expect(legacyJobs).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				shootId: legacyIds.ics,
				jobType: "ics_send_cancel",
				payload: expect.objectContaining({
					target: expect.objectContaining({
						recipientEmail: `delivered-${suffix}@example.com`,
						icalUid: `delivered-${suffix}@example.invalid`,
						icalSequence: 6,
					}),
				}),
			}),
			expect.objectContaining({
				shootId: legacyIds.google,
				jobType: "google_delete",
				payload: expect.objectContaining({
					target: expect.objectContaining({
						calendarId: "legacy-primary",
						googleEventId: `legacy-event-${suffix}`,
						googleConnectionId: (googleSource.payload as any).target
							.googleConnectionId,
					}),
				}),
			}),
		]),
	);
	expect(
		legacyJobs.filter((job: any) =>
			[legacyIds.noEffect, legacyIds.manual].includes(job.shootId),
		),
	).toHaveLength(0);

	const icsJob = legacyJobs.find((job: any) => job.shootId === legacyIds.ics);
	if (!icsJob) {
		throw new Error("Expected legacy ICS cancellation job");
	}
	const callsBeforeCancellation = mailBarrier.calls.length;
	const [claimed] = await db
		.update(calendarSyncJobs)
		.set({
			status: "processing",
			attempts: 1,
			lockedAt: new Date(),
			claimToken: `legacy-cancel-${suffix}`,
		})
		.where(eq(calendarSyncJobs.id, icsJob.id))
		.returning();
	await processJob(claimed);
	expect(mailBarrier.calls.slice(callsBeforeCancellation)).toEqual([
		expect.objectContaining({ to: `delivered-${suffix}@example.com` }),
	]);

	const jobCountBeforeSecondRun = legacyJobs.length;
	const second = await reconcileCalendarDeliveries({
		organizationId,
		apply: true,
	});
	expect(second.failed).toBeGreaterThanOrEqual(2);
	const afterSecondRun = (
		await db
			.select()
			.from(calendarSyncJobs)
			.where(eq(calendarSyncJobs.organizationId, organizationId))
	).filter((job: any) => Object.values(legacyIds).includes(job.shootId));
	expect(afterSecondRun).toHaveLength(jobCountBeforeSecondRun);

	await db.insert(shootCalendarEvents).values({
		organizationId,
		shootId: legacyIds.uncertain,
		crewId: legacyIds.uncertain,
		deliveryMethod: "ics",
		intentGeneration: 2,
		intentState: "active",
		syncStatus: "pending",
		deliverySyncStatus: "pending",
		cancellationSyncStatus: "pending",
	});
	const [uncertainJob] = await db
		.insert(calendarSyncJobs)
		.values({
			organizationId,
			deliveryKey: `calendar:${organizationId}:${legacyIds.uncertain}:${legacyIds.uncertain}:cancellation:1`,
			status: "processing",
			jobType: "ics_send_cancel",
			shootId: legacyIds.uncertain,
			crewId: legacyIds.uncertain,
			generation: 1,
			attempts: 1,
			maxAttempts: 1,
			lockedAt: new Date(Date.now() - 20 * 60 * 1000),
			payload: {
				operation: "cancellation",
				intentState: "active",
				target: { deliveryMethod: "ics" },
			},
		})
		.returning();
	await recoverStaleProcessingJobs();
	expect(
		await db.query.shootCalendarEvents.findFirst({
			where: and(
				eq(shootCalendarEvents.organizationId, organizationId),
				eq(shootCalendarEvents.shootId, legacyIds.uncertain),
			),
		}),
	).toMatchObject({
		intentGeneration: 2,
		cancellationSyncStatus: "manual_reconciliation",
		cancellationLastError: "Calendar worker lease exhausted",
	});
	expect(
		await db.query.calendarSyncJobs.findFirst({
			where: eq(calendarSyncJobs.id, uncertainJob.id),
		}),
	).toMatchObject({
		status: "failed",
		effectState: "manual_reconciliation",
		nextAttemptAt: null,
	});

	await assertProviderOutcomeRecovery(ctx);
}
