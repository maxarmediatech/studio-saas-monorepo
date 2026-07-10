import { describe, expect, it } from "vitest";

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
	expect(jobs.filter((job: any) => job.status === "pending")).toEqual([
		expect.objectContaining({ generation: 2 }),
	]);
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
		route,
		shootAssignments,
		shootCalendarEvents,
		shoots,
		staleIds,
		suffix,
		ids,
		buildEventInput,
		enqueueCalendarCancellation,
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
	mailBarrier.block();
	const inFlight = processJob(claimed);
	await new Promise((resolve) => setTimeout(resolve, 0));
	await db
		.update(crews)
		.set({ email: `newer-${suffix}@example.com` })
		.where(eq(crews.id, ids.externalIcs));
	await route(ids.externalIcs);
	mailBarrier.release();
	await inFlight;
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
		.update(calendarSyncJobs)
		.set({ status: "processing", lockedAt: new Date() })
		.where(
			and(
				eq(calendarSyncJobs.organizationId, organizationId),
				eq(calendarSyncJobs.shootId, ids.externalIcs),
			),
		);
	await db.transaction(async (tx: any) => {
		await enqueueCalendarCancellation(tx, {
			organizationId,
			shootId: ids.externalIcs,
			crewId: ids.externalIcs,
		});
		await tx
			.delete(shootAssignments)
			.where(
				and(
					eq(shootAssignments.shootId, ids.externalIcs),
					eq(shootAssignments.crewId, ids.externalIcs),
				),
			);
	});
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
	await expect(
		buildEventInput({
			organizationId,
			shootId: ids.externalIcs,
			crewId: ids.externalIcs,
			allowMissingAssignment: true,
		}),
	).resolves.toBeDefined();
}
