import { describe, expect, it } from "vitest";

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
		const { claimJobBatch, recoverStaleProcessingJobs } = await import(
			"../../../../../services/calendar-worker/src/index"
		);
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
			const [reroutedJob] = await db
				.select()
				.from(calendarSyncJobs)
				.where(
					and(
						eq(calendarSyncJobs.organizationId, organizationId),
						eq(calendarSyncJobs.shootId, ids.registeredIcs),
					),
				);
			expect(reroutedMapping).toMatchObject({ deliveryMethod: "google" });
			expect(reroutedJob).toMatchObject({
				jobType: "google_create",
				attempts: 0,
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
				jobType: "ics_send_invite",
			});
			expect(retryJob?.nextAttemptAt?.getTime()).toBe(retryAt.getTime());

			await db
				.update(calendarSyncJobs)
				.set({ status: "failed", attempts: 5, nextAttemptAt: null })
				.where(eq(calendarSyncJobs.id, retryJob.id));
			const terminalRetry = await route(ids.retry);
			expect(terminalRetry.state).toBe("error");
			const [terminalJob] = await db
				.select()
				.from(calendarSyncJobs)
				.where(eq(calendarSyncJobs.id, retryJob.id));
			expect(terminalJob).toMatchObject({
				status: "failed",
				attempts: 5,
			});

			const failedDeliveryKey = `calendar:${organizationId}:${ids.failed}:${ids.failed}:delivery`;
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
			const failedResult = await route(ids.failed);
			expect(failedResult.state).toBe("error");
			const failedMapping = await db.query.shootCalendarEvents.findFirst({
				where: and(
					eq(shootCalendarEvents.organizationId, organizationId),
					eq(shootCalendarEvents.shootId, ids.failed),
				),
			});
			expect(failedMapping?.syncStatus).toBe("error");
			expect(failedMapping?.lastError).toContain(
				"injected calendar producer failure",
			);

			await db.execute(
				sql.raw(`DROP TRIGGER "${triggerName}" ON calendar_sync_jobs`),
			);
			await db.execute(sql.raw(`DROP FUNCTION "${functionName}"()`));
			triggerCreated = false;

			await db.insert(shootCalendarEvents).values({
				organizationId,
				shootId: ids.pending,
				crewId: ids.pending,
				deliveryMethod: "ics",
				recipientEmail: `pending-${suffix}@example.com`,
				icalUid: `pending-${suffix}@example.invalid`,
				syncStatus: "pending",
			});
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

			await db
				.update(crews)
				.set({ email: `current-${suffix}@example.com` })
				.where(eq(crews.id, ids.externalIcs));
			await db
				.update(shoots)
				.set({ name: "Current shoot truth" })
				.where(eq(shoots.id, ids.externalIcs));
			const workerInput = await buildEventInput({
				organizationId,
				shootId: ids.externalIcs,
				crewId: ids.externalIcs,
			});
			expect(workerInput.crew.email).toBe(
				`current-${suffix}@example.com`,
			);
			expect(workerInput.input.title).toContain("Current shoot truth");
			expect(workerInput.input.description).toContain(
				"Time zone: Asia/Kolkata",
			);
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
					bookingId,
					name: "Stale retryable shoot",
					shootType: "wedding",
					shootDate: "2026-12-31",
					startTime: "09:30",
					status: "scheduled",
				},
				{
					id: staleIds.terminalShoot,
					organizationId,
					bookingId,
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
					deliveryKey: `calendar:${organizationId}:${staleIds.retryableShoot}:${staleIds.retryableCrew}:delivery`,
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
					deliveryKey: `calendar:${organizationId}:${staleIds.terminalShoot}:${staleIds.terminalCrew}:delivery`,
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
			const claimed = await claimJobBatch();
			expect(claimed).toEqual(
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
			await db.transaction(async (tx) => {
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
			expect(cancellationJobs).toHaveLength(2);
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
