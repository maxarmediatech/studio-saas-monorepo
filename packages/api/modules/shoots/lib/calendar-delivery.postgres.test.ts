import { describe, expect, it, vi } from "vitest";
import { runCalendarDeliveryAdversarialAssertions } from "./calendar-delivery-adversarial.postgres.test";

const mailBarrier = vi.hoisted(() => {
	let release: (() => void) | undefined;
	let wait: Promise<void> | undefined;
	return {
		calls: [] as unknown[],
		block() {
			wait = new Promise<void>((resolve) => {
				release = resolve;
			});
		},
		release() {
			release?.();
			wait = undefined;
		},
		async send(input: unknown) {
			this.calls.push(input);
			await wait;
		},
	};
});

vi.mock("@repo/mail", () => ({
	sendCalendarInviteEmail: (input: unknown) => mailBarrier.send(input),
}));

// Set to an isolated database migrated through 0041_calendar_delivery_identity.
const databaseUrl = process.env.POSTGRES_CALENDAR_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres("calendar delivery on migrated PostgreSQL", () => {
	it("routes, preserves retries, reconciles delivery changes, and recovers stale worker jobs", async () => {
		const originalDatabaseUrl = process.env.DATABASE_URL;
		const originalAuthSecret = process.env.BETTER_AUTH_SECRET;
		const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
		process.env.DATABASE_URL = databaseUrl;
		process.env.BETTER_AUTH_SECRET =
			originalAuthSecret ?? "calendar-test-secret-at-least-32-characters";
		process.env.NEXT_PUBLIC_SITE_URL =
			originalSiteUrl ?? "https://calendar.test.example.com";

		const {
			and,
			bookings,
			calendarDeliveryIntents,
			calendarSyncJobs,
			crews,
			db,
			eq,
			googleCalendarConnections,
			inArray,
			organizations,
			shootAssignments,
			shootCalendarEvents,
			shoots,
			sql,
			users,
		} = await import("@repo/database");
		const {
			enqueueCalendarCancellation,
			ensureAssignmentCalendarDelivery,
			reconcileCalendarDeliveries,
		} = await import("./calendar-delivery");
		const { claimJobBatch, processJob, recoverStaleProcessingJobs } =
			await import("../../../../../services/calendar-worker/src/index");
		const { buildEventInput } = await import(
			"../../../../../services/calendar-worker/src/event-input"
		);

		const suffix = `${process.pid}_${Date.now()}`;
		const organizationId = `calendar_org_${suffix}`;
		const otherOrganizationId = `calendar_other_org_${suffix}`;
		const bookingId = `calendar_booking_${suffix}`;
		const otherBookingId = `calendar_other_booking_${suffix}`;
		const googleUserId = `calendar_google_user_${suffix}`;
		const registeredUserId = `calendar_registered_user_${suffix}`;
		const triggerName = `calendar_job_failure_${suffix}`;
		const functionName = `${triggerName}_fn`;
		const ids = {
			google: `calendar_google_${suffix}`,
			registeredIcs: `calendar_registered_ics_${suffix}`,
			externalIcs: `calendar_external_ics_${suffix}`,
			unsendable: `calendar_unsendable_${suffix}`,
			failed: `calendar_failed_${suffix}`,
			retry: `calendar_retry_${suffix}`,
			missing: `calendar_missing_${suffix}`,
			pending: `calendar_pending_${suffix}`,
		};
		const staleIds = {
			retryableCrew: `calendar_stale_crew_${suffix}`,
			retryableShoot: `calendar_stale_shoot_${suffix}`,
			terminalCrew: `calendar_stale_terminal_crew_${suffix}`,
			terminalShoot: `calendar_stale_terminal_shoot_${suffix}`,
		};
		let triggerCreated = false;

		try {
			await db.insert(organizations).values([
				{
					id: organizationId,
					name: "Calendar delivery test",
					slug: `calendar-${suffix}`,
					timezone: "Asia/Kolkata",
				},
				{
					id: otherOrganizationId,
					name: "Other calendar tenant",
					slug: `calendar-other-${suffix}`,
				},
			]);
			await db.insert(users).values([
				{
					id: googleUserId,
					name: "Google Crew",
					email: `google-${suffix}@example.com`,
				},
				{
					id: registeredUserId,
					name: "Registered ICS Crew",
					email: `registered-${suffix}@example.com`,
				},
			]);
			await db.insert(bookings).values([
				{
					id: bookingId,
					organizationId,
					referenceNumber: `CAL-${suffix}`,
					name: "Current booking truth",
					bookingType: "event",
					packageType: "standard",
					packageCost: "100.00",
				},
				{
					id: otherBookingId,
					organizationId: otherOrganizationId,
					referenceNumber: `OTHER-${suffix}`,
					name: "Other tenant booking",
					bookingType: "event",
					packageType: "standard",
					packageCost: "100.00",
				},
			]);

			const crewRows = [
				{
					id: ids.google,
					organizationId,
					userId: googleUserId,
					name: "Google Crew",
					email: `google-${suffix}@example.com`,
				},
				{
					id: ids.registeredIcs,
					organizationId,
					userId: registeredUserId,
					name: "Registered ICS Crew",
					email: `registered-${suffix}@example.com`,
				},
				...Object.entries({
					[ids.externalIcs]: `external-${suffix}@example.com`,
					[ids.failed]: `failed-${suffix}@example.com`,
					[ids.retry]: `retry-${suffix}@example.com`,
					[ids.missing]: `missing-${suffix}@example.com`,
					[ids.pending]: `pending-${suffix}@example.com`,
				}).map(([id, email]) => ({
					id,
					organizationId,
					name: id,
					email,
				})),
				{
					id: ids.unsendable,
					organizationId,
					name: "Unsendable Crew",
					email: null,
				},
			];
			await db.insert(crews).values(crewRows);
			await db.insert(googleCalendarConnections).values({
				organizationId,
				userId: googleUserId,
				refreshToken: "encrypted-test-token",
			});

			await db.insert(shoots).values(
				Object.values(ids).map((id) => ({
					id,
					organizationId,
					bookingId,
					name: `Shoot ${id}`,
					shootType: "wedding",
					shootDate: "2026-12-31",
					startTime: "09:30",
					status: "scheduled",
				})),
			);
			await db.insert(shootAssignments).values(
				Object.values(ids).map((id) => ({
					shootId: id,
					crewId: id,
					role: "Photographer",
				})),
			);

			const route = (id: string) =>
				db.transaction((tx) =>
					ensureAssignmentCalendarDelivery(tx, {
						organizationId,
						shootId: id,
						crewId: id,
					}),
				);
			const [google, registeredIcs, externalIcs, unsendable] =
				await Promise.all([
					route(ids.google),
					route(ids.registeredIcs),
					route(ids.externalIcs),
					route(ids.unsendable),
				]);
			expect(google.deliveryMethod).toBe("google");
			expect(registeredIcs.deliveryMethod).toBe("ics");
			expect(externalIcs.deliveryMethod).toBe("ics");
			expect(unsendable).toMatchObject({
				deliveryMethod: "unsendable",
				jobType: null,
				state: "unsendable",
			});

			await db.insert(googleCalendarConnections).values({
				organizationId,
				userId: registeredUserId,
				refreshToken: "encrypted-registered-test-token",
			});
			await reconcileCalendarDeliveries({
				organizationId,
				crewId: ids.registeredIcs,
				apply: true,
			});
			const [reroutedMapping] = await db
				.select()
				.from(shootCalendarEvents)
				.where(
					and(
						eq(shootCalendarEvents.organizationId, organizationId),
						eq(shootCalendarEvents.shootId, ids.registeredIcs),
					),
				);
			const reroutedJobs = await db
				.select()
				.from(calendarSyncJobs)
				.where(
					and(
						eq(calendarSyncJobs.organizationId, organizationId),
						eq(calendarSyncJobs.shootId, ids.registeredIcs),
					),
				);
			expect(reroutedMapping).toMatchObject({
				deliveryMethod: "google",
				intentGeneration: 2,
			});
			const reroutedJob = reroutedJobs.find(
				(job) => job.generation === reroutedMapping?.intentGeneration,
			);
			expect(reroutedJob).toMatchObject({
				jobType: "google_create",
				attempts: 0,
				generation: 2,
			});
			expect(reroutedJob?.payload).toMatchObject({
				operation: "delivery",
				target: {
					deliveryMethod: "google",
					googleUserId: registeredUserId,
				},
			});

			await Promise.all([
				route(ids.externalIcs),
				route(ids.externalIcs),
				route(ids.externalIcs),
			]);
			let jobs = await db
				.select()
				.from(calendarSyncJobs)
				.where(eq(calendarSyncJobs.organizationId, organizationId));
			expect(
				jobs.filter((job) => job.shootId === ids.externalIcs),
			).toHaveLength(1);

			await route(ids.retry);
			const retryAt = new Date(Date.now() + 60_000);
			await db
				.update(calendarSyncJobs)
				.set({
					status: "failed",
					attempts: 2,
					maxAttempts: 5,
					jobType: "google_create",
					nextAttemptAt: retryAt,
				})
				.where(
					and(
						eq(calendarSyncJobs.organizationId, organizationId),
						eq(calendarSyncJobs.shootId, ids.retry),
					),
				);
			await route(ids.retry);
			const [retryJob] = await db
				.select()
				.from(calendarSyncJobs)
				.where(
					and(
						eq(calendarSyncJobs.organizationId, organizationId),
						eq(calendarSyncJobs.shootId, ids.retry),
					),
				);
			if (!retryJob) {
				throw new Error("Expected retry calendar job");
			}
			expect(retryJob).toMatchObject({
				status: "failed",
				attempts: 2,
				jobType: "google_create",
			});
			expect(retryJob?.nextAttemptAt?.getTime()).toBe(retryAt.getTime());

			await db
				.update(calendarSyncJobs)
				.set({ status: "failed", attempts: 5, nextAttemptAt: null })
				.where(eq(calendarSyncJobs.id, retryJob.id));
			const terminalRetry = await route(ids.retry);
			expect(terminalRetry.state).toBe("queued");
			const [terminalJob] = await db
				.select()
				.from(calendarSyncJobs)
				.where(eq(calendarSyncJobs.id, retryJob.id));
			expect(terminalJob).toMatchObject({
				status: "failed",
				attempts: 5,
			});

			const failedDeliveryKey = `calendar:${organizationId}:${ids.failed}:${ids.failed}:delivery:1`;
			await db.execute(
				sql.raw(`CREATE FUNCTION "${functionName}"() RETURNS trigger AS $$
					BEGIN
						IF NEW.delivery_key = '${failedDeliveryKey}' THEN
							RAISE EXCEPTION 'injected calendar producer failure';
						END IF;
						RETURN NEW;
					END;
				$$ LANGUAGE plpgsql`),
			);
			await db.execute(
				sql.raw(`CREATE TRIGGER "${triggerName}" BEFORE INSERT OR UPDATE
					ON calendar_sync_jobs FOR EACH ROW EXECUTE FUNCTION "${functionName}"()`),
			);
			triggerCreated = true;
			await expect(route(ids.failed)).rejects.toThrow(
				"injected calendar producer failure",
			);
			await expect(
				db.query.shootCalendarEvents.findFirst({
					where: and(
						eq(shootCalendarEvents.organizationId, organizationId),
						eq(shootCalendarEvents.shootId, ids.failed),
					),
				}),
			).resolves.toBeUndefined();

			await db.execute(
				sql.raw(`DROP TRIGGER "${triggerName}" ON calendar_sync_jobs`),
			);
			await db.execute(sql.raw(`DROP FUNCTION "${functionName}"()`));
			triggerCreated = false;

			await db
				.insert(shootCalendarEvents)
				.values({
					organizationId,
					shootId: ids.pending,
					crewId: ids.pending,
					deliveryMethod: "ics",
					recipientEmail: `pending-${suffix}@example.com`,
					icalUid: `pending-${suffix}@example.invalid`,
					syncStatus: "pending",
				})
				.onConflictDoNothing();
			await Promise.all([
				reconcileCalendarDeliveries({ organizationId, apply: true }),
				reconcileCalendarDeliveries({ organizationId, apply: true }),
			]);
			jobs = await db
				.select()
				.from(calendarSyncJobs)
				.where(eq(calendarSyncJobs.organizationId, organizationId));
			for (const id of [ids.failed, ids.missing, ids.pending]) {
				expect(jobs.filter((job) => job.shootId === id)).toHaveLength(
					1,
				);
			}

			await expect(
				db.transaction((tx) =>
					ensureAssignmentCalendarDelivery(tx, {
						organizationId: otherOrganizationId,
						shootId: ids.externalIcs,
						crewId: ids.externalIcs,
					}),
				),
			).rejects.toThrow("not an active assignment");

			await runCalendarDeliveryAdversarialAssertions({
				and,
				bookingId,
				buildEventInput,
				calendarDeliveryIntents,
				calendarSyncJobs,
				claimJobBatch,
				crews,
				db,
				enqueueCalendarCancellation,
				eq,
				expect,
				ids,
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
			});
		} finally {
			if (triggerCreated) {
				await db.execute(
					sql.raw(
						`DROP TRIGGER IF EXISTS "${triggerName}" ON calendar_sync_jobs`,
					),
				);
				await db.execute(
					sql.raw(`DROP FUNCTION IF EXISTS "${functionName}"()`),
				);
			}
			await db
				.delete(organizations)
				.where(eq(organizations.id, organizationId));
			await db
				.delete(organizations)
				.where(eq(organizations.id, otherOrganizationId));
			await db.delete(users).where(eq(users.id, googleUserId));
			await db.delete(users).where(eq(users.id, registeredUserId));
			restoreEnvironment("DATABASE_URL", originalDatabaseUrl);
			restoreEnvironment("BETTER_AUTH_SECRET", originalAuthSecret);
			restoreEnvironment("NEXT_PUBLIC_SITE_URL", originalSiteUrl);
		}
	}, 15_000);
});

function restoreEnvironment(name: string, value: string | undefined) {
	if (value === undefined) {
		delete process.env[name];
		return;
	}
	process.env[name] = value;
}
