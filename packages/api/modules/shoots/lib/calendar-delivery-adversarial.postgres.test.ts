import { describe, expect, it } from "vitest";
import { assertCancellationFailureState } from "./calendar-delivery-worker-state.postgres.test";

describe("calendar delivery adversarial PostgreSQL assertions", () => {
	it("exports the scenario invoked by the migrated baseline suite", () => {
		expect(runCalendarDeliveryAdversarialAssertions).toBeTypeOf("function");
		expect(runCalendarDeliveryIdempotencyAssertions).toBeTypeOf("function");
	});
});

// biome-ignore lint/suspicious/noExportsInTest: baseline suite imports this executable scenario.
export async function runCalendarDeliveryIdempotencyAssertions(ctx: any) {
	const {
		calendarDeliveryIntents,
		calendarSyncJobs,
		db,
		eq,
		expect,
		id,
		organizationId,
		route,
		shootCalendarEvents,
		shoots,
	} = ctx;
	await route(id);
	await route(id);
	const repeated = await Promise.allSettled([
		route(id),
		route(id),
		route(id),
	]);
	expect(repeated.every((result) => result.status === "fulfilled")).toBe(
		true,
	);

	let intents = await db
		.select()
		.from(calendarDeliveryIntents)
		.where(eq(calendarDeliveryIntents.shootId, id));
	let jobs = await db
		.select()
		.from(calendarSyncJobs)
		.where(eq(calendarSyncJobs.shootId, id));
	expect(intents).toHaveLength(1);
	expect(intents[0]).toMatchObject({ generation: 1, state: "active" });
	expect(jobs).toHaveLength(1);
	expect(jobs[0]).toMatchObject({ generation: 1, status: "pending" });
	await db.insert(calendarSyncJobs).values({
		organizationId,
		deliveryKey: `calendar:${organizationId}:${id}:${id}:cancellation:1`,
		status: "pending",
		jobType: "ics_send_cancel",
		shootId: id,
		crewId: id,
		generation: 1,
		payload: {
			operation: "cancellation",
			intentState: "active",
			target: { deliveryMethod: "ics" },
		},
	});

	await db
		.update(shoots)
		.set({ name: "Material calendar update" })
		.where(eq(shoots.id, id));
	const updated = await Promise.allSettled([route(id), route(id), route(id)]);
	expect(updated.every((result) => result.status === "fulfilled")).toBe(true);
	intents = await db
		.select()
		.from(calendarDeliveryIntents)
		.where(eq(calendarDeliveryIntents.shootId, id));
	jobs = await db
		.select()
		.from(calendarSyncJobs)
		.where(eq(calendarSyncJobs.shootId, id));
	expect(intents).toHaveLength(2);
	expect(
		intents.filter((intent: any) => intent.generation === 2),
	).toHaveLength(1);
	const pendingJobs = jobs.filter((job: any) => job.status === "pending");
	expect(pendingJobs).toHaveLength(2);
	expect(pendingJobs).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				generation: 1,
				jobType: "ics_send_cancel",
			}),
			expect.objectContaining({ generation: 2 }),
		]),
	);
	const generationTwo = intents.find(
		(intent: any) => intent.generation === 2,
	);
	if (!generationTwo) {
		throw new Error("Expected material update generation");
	}
	await db
		.update(shootCalendarEvents)
		.set({
			deliveredGeneration: 2,
			deliveredDeliveryMethod: "ics",
			deliveredRecipientEmail: generationTwo.recipientEmail,
			deliveredIcalUid: generationTwo.payload.target.icalUid,
			deliveredIcalSequence: generationTwo.payload.target.icalSequence,
		})
		.where(eq(shootCalendarEvents.shootId, id));
	await db
		.update(shoots)
		.set({ name: "Delivered same-route update" })
		.where(eq(shoots.id, id));
	await route(id);
	const deliveredUpdate = (
		await db
			.select()
			.from(calendarDeliveryIntents)
			.where(eq(calendarDeliveryIntents.shootId, id))
	).find((intent: any) => intent.generation === 3);
	expect(deliveredUpdate).toMatchObject({
		generation: 3,
		payload: {
			target: {
				icalUid: generationTwo.payload.target.icalUid,
				icalSequence: generationTwo.payload.target.icalSequence + 1,
			},
		},
	});
	return db
		.select()
		.from(calendarSyncJobs)
		.where(eq(calendarSyncJobs.organizationId, organizationId));
}

/** Shared adversarial portion of the migrated Calendar PostgreSQL suite. */
// biome-ignore lint/suspicious/noExportsInTest: baseline suite imports this executable scenario.
export async function runCalendarDeliveryAdversarialAssertions(ctx: any) {
	const {
		and,
		calendarDeliveryIntents,
		calendarSyncJobs,
		claimJobBatch,
		crews,
		db,
		eq,
		expect,
		inArray,
		mailBarrier,
		organizationId,
		otherOrganizationId,
		processJob,
		recoverStaleProcessingJobs,
		reconcileCalendarDeliveries,
		route,
		shootAssignments,
		shootCalendarEvents,
		shoots,
		staleIds,
		suffix,
		ids,
		buildEventInput,
	} = ctx;

	await db
		.update(crews)
		.set({ email: `current-${suffix}@example.com` })
		.where(eq(crews.id, ids.externalIcs));
	await db
		.update(shootCalendarEvents)
		.set({
			deliveredGeneration: 1,
			deliveredDeliveryMethod: "ics",
			deliveredRecipientEmail: `external-${suffix}@example.com`,
			deliveredIcalUid: `external-${suffix}@example.invalid`,
			deliveredIcalSequence: 3,
		})
		.where(
			and(
				eq(shootCalendarEvents.organizationId, organizationId),
				eq(shootCalendarEvents.shootId, ids.externalIcs),
			),
		);
	await route(ids.externalIcs);
	const intents = await db
		.select()
		.from(calendarDeliveryIntents)
		.where(
			and(
				eq(calendarDeliveryIntents.organizationId, organizationId),
				eq(calendarDeliveryIntents.shootId, ids.externalIcs),
			),
		);
	expect(intents).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ generation: 2, state: "active" }),
		]),
	);
	const jobs = (
		await db
			.select()
			.from(calendarSyncJobs)
			.where(
				and(
					eq(calendarSyncJobs.organizationId, organizationId),
					eq(calendarSyncJobs.shootId, ids.externalIcs),
					eq(calendarSyncJobs.generation, 2),
				),
			)
	).sort((a: any, b: any) => a.jobType.localeCompare(b.jobType));
	expect(jobs).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				jobType: "ics_send_cancel",
				payload: expect.objectContaining({
					target: expect.objectContaining({
						recipientEmail: `external-${suffix}@example.com`,
						icalUid: `external-${suffix}@example.invalid`,
					}),
				}),
			}),
			expect.objectContaining({
				jobType: "ics_send_update",
				payload: expect.objectContaining({
					target: expect.objectContaining({
						recipientEmail: `current-${suffix}@example.com`,
					}),
				}),
			}),
		]),
	);
	const processing = jobs.find(
		(job: any) => job.jobType === "ics_send_update",
	);
	if (!processing) {
		throw new Error("Expected replacement delivery job");
	}
	await db
		.update(calendarSyncJobs)
		.set({
			status: "processing",
			attempts: 1,
			lockedAt: new Date(),
			claimToken: `barrier-${suffix}`,
		})
		.where(eq(calendarSyncJobs.id, processing.id));
	const [claimed] = await db
		.select()
		.from(calendarSyncJobs)
		.where(eq(calendarSyncJobs.id, processing.id));
	if (!claimed) {
		throw new Error("Expected claimed replacement delivery job");
	}
	const callsBeforeBarrier = mailBarrier.calls.length;
	mailBarrier.block();
	const inFlight = processJob(claimed);
	await mailBarrier.waitForCalls(callsBeforeBarrier + 1);
	const reclaim = db
		.update(calendarSyncJobs)
		.set({ claimToken: `reclaimed-${suffix}`, lockedAt: new Date() })
		.where(
			and(
				eq(calendarSyncJobs.id, processing.id),
				eq(calendarSyncJobs.status, "processing"),
				eq(calendarSyncJobs.claimToken, `barrier-${suffix}`),
			),
		);
	await db
		.update(crews)
		.set({ email: `newer-${suffix}@example.com` })
		.where(eq(crews.id, ids.externalIcs));
	const reroute = route(ids.externalIcs);
	mailBarrier.release();
	await Promise.all([inFlight, reclaim, reroute]);
	const [afterBarrier] = await db
		.select()
		.from(shootCalendarEvents)
		.where(
			and(
				eq(shootCalendarEvents.organizationId, organizationId),
				eq(shootCalendarEvents.shootId, ids.externalIcs),
			),
		);
	expect(afterBarrier).toMatchObject({
		intentGeneration: 3,
		recipientEmail: `newer-${suffix}@example.com`,
	});
	const [reclaimedJob] = await db
		.select()
		.from(calendarSyncJobs)
		.where(eq(calendarSyncJobs.id, processing.id));
	expect(reclaimedJob).toMatchObject({
		status: "completed",
		claimToken: null,
	});
	const staleProviderCalls = mailBarrier.calls.slice(callsBeforeBarrier);
	expect(staleProviderCalls).toHaveLength(1);
	expect(staleProviderCalls).toEqual([
		expect.objectContaining({
			to: `current-${suffix}@example.com`,
			subject: expect.stringContaining("Calendar Invite"),
		}),
	]);

	await db
		.update(shoots)
		.set({ name: "Current shoot truth" })
		.where(eq(shoots.id, ids.externalIcs));
	const workerInput = await buildEventInput({
		organizationId,
		shootId: ids.externalIcs,
		crewId: ids.externalIcs,
	});
	expect(workerInput.crew.email).toBe(`newer-${suffix}@example.com`);
	expect(workerInput.input.title).toContain("Current shoot truth");
	await expect(
		buildEventInput({
			organizationId: otherOrganizationId,
			shootId: ids.externalIcs,
			crewId: ids.externalIcs,
		}),
	).rejects.toThrow("Shoot not found");

	await db.insert(crews).values([
		{
			id: staleIds.retryableCrew,
			organizationId,
			name: "Stale retryable crew",
			email: `stale-retryable-${suffix}@example.com`,
		},
		{
			id: staleIds.terminalCrew,
			organizationId,
			name: "Stale terminal crew",
			email: `stale-terminal-${suffix}@example.com`,
		},
	]);
	await db.insert(shoots).values([
		{
			id: staleIds.retryableShoot,
			organizationId,
			bookingId: ctx.bookingId,
			name: "Stale retryable shoot",
			shootType: "wedding",
			shootDate: "2026-12-31",
			startTime: "09:30",
			status: "scheduled",
		},
		{
			id: staleIds.terminalShoot,
			organizationId,
			bookingId: ctx.bookingId,
			name: "Stale terminal shoot",
			shootType: "wedding",
			shootDate: "2026-12-31",
			startTime: "09:30",
			status: "scheduled",
		},
	]);
	const staleLockedAt = new Date(Date.now() - 20 * 60 * 1000);
	await db.insert(shootCalendarEvents).values({
		organizationId,
		shootId: staleIds.terminalShoot,
		crewId: staleIds.terminalCrew,
		deliveryMethod: "ics",
		recipientEmail: `stale-terminal-${suffix}@example.com`,
		intentGeneration: 1,
		intentState: "active",
		syncStatus: "pending",
		deliverySyncStatus: "pending",
	});
	await db.insert(calendarSyncJobs).values([
		{
			organizationId,
			deliveryKey: `calendar:${organizationId}:${staleIds.retryableShoot}:${staleIds.retryableCrew}:delivery:1`,
			status: "processing",
			jobType: "ics_send_invite",
			shootId: staleIds.retryableShoot,
			crewId: staleIds.retryableCrew,
			attempts: 1,
			maxAttempts: 5,
			lockedAt: staleLockedAt,
			createdAt: new Date(0),
		},
		{
			organizationId,
			deliveryKey: `calendar:${organizationId}:${staleIds.terminalShoot}:${staleIds.terminalCrew}:delivery:1`,
			status: "processing",
			jobType: "ics_send_invite",
			shootId: staleIds.terminalShoot,
			crewId: staleIds.terminalCrew,
			generation: 1,
			attempts: 5,
			maxAttempts: 5,
			lockedAt: staleLockedAt,
		},
	]);
	await recoverStaleProcessingJobs();
	const staleJobs = await db
		.select()
		.from(calendarSyncJobs)
		.where(
			and(
				eq(calendarSyncJobs.organizationId, organizationId),
				inArray(calendarSyncJobs.shootId, [
					staleIds.retryableShoot,
					staleIds.terminalShoot,
				]),
			),
		);
	expect(staleJobs).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				shootId: staleIds.retryableShoot,
				status: "failed",
				attempts: 1,
				lockedAt: null,
			}),
			expect.objectContaining({
				shootId: staleIds.terminalShoot,
				status: "failed",
				attempts: 5,
				nextAttemptAt: null,
				lockedAt: null,
			}),
		]),
	);
	const exhaustedMapping = await db.query.shootCalendarEvents.findFirst({
		where: and(
			eq(shootCalendarEvents.organizationId, organizationId),
			eq(shootCalendarEvents.shootId, staleIds.terminalShoot),
		),
	});
	expect(exhaustedMapping).toMatchObject({
		syncStatus: "error",
		deliverySyncStatus: "error",
		deliveryLastError: "Calendar worker lease exhausted",
	});
	await db
		.delete(shootCalendarEvents)
		.where(eq(shootCalendarEvents.id, exhaustedMapping?.id ?? ""));
	expect(await claimJobBatch()).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				shootId: staleIds.retryableShoot,
				status: "processing",
				attempts: 2,
			}),
		]),
	);
	await db
		.update(shoots)
		.set({ status: "cancelled" })
		.where(eq(shoots.id, ids.unsendable));
	await route(ids.unsendable);
	const unsendableCancellation = await db.query.shootCalendarEvents.findFirst(
		{
			where: and(
				eq(shootCalendarEvents.organizationId, organizationId),
				eq(shootCalendarEvents.shootId, ids.unsendable),
			),
		},
	);
	expect(unsendableCancellation).toMatchObject({
		intentState: "cancelled",
		syncStatus: "deleted",
	});

	await db
		.update(calendarSyncJobs)
		.set({ status: "processing", lockedAt: new Date() })
		.where(
			and(
				eq(calendarSyncJobs.organizationId, organizationId),
				eq(calendarSyncJobs.shootId, ids.externalIcs),
			),
		);
	await db
		.delete(shootAssignments)
		.where(
			and(
				eq(shootAssignments.shootId, ids.externalIcs),
				eq(shootAssignments.crewId, ids.externalIcs),
			),
		);
	await reconcileCalendarDeliveries({ organizationId, apply: true });
	await reconcileCalendarDeliveries({ organizationId, apply: true });
	const cancellationJobs = await db
		.select()
		.from(calendarSyncJobs)
		.where(
			and(
				eq(calendarSyncJobs.organizationId, organizationId),
				eq(calendarSyncJobs.shootId, ids.externalIcs),
			),
		);
	expect(cancellationJobs).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				jobType: "ics_send_cancel",
				status: "pending",
			}),
		]),
	);
	const cancellationIntents = await db
		.select()
		.from(calendarDeliveryIntents)
		.where(
			and(
				eq(calendarDeliveryIntents.organizationId, organizationId),
				eq(calendarDeliveryIntents.shootId, ids.externalIcs),
				eq(calendarDeliveryIntents.state, "cancelled"),
			),
		);
	expect(cancellationIntents).toHaveLength(1);
	expect(cancellationIntents[0]?.payload).toMatchObject({
		eventInput: { date: "2026-12-31" },
		target: {
			recipientEmail: `current-${suffix}@example.com`,
			icalSequence: 5,
		},
	});
	await assertCancellationFailureState({
		and,
		calendarSyncJobs,
		db,
		eq,
		expect,
		id: ids.externalIcs,
		organizationId,
		processJob,
		shootCalendarEvents,
	});
	await expect(
		buildEventInput({
			organizationId,
			shootId: ids.externalIcs,
			crewId: ids.externalIcs,
			allowMissingAssignment: true,
		}),
	).resolves.toBeDefined();
}
