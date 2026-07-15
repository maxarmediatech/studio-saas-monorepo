import { describe, expect, it } from "vitest";

describe("calendar route identity PostgreSQL assertions", () => {
	it("exports the scenario invoked by the migrated baseline suite", () => {
		expect(assertRouteIdentityTransitions).toBeTypeOf("function");
	});
});

// biome-ignore lint/suspicious/noExportsInTest: baseline suite imports this executable scenario.
export async function assertRouteIdentityTransitions(ctx: any) {
	const {
		and,
		bookingId,
		calendarDeliveryIntents,
		calendarRouteChanges,
		calendarSyncJobs,
		crews,
		db,
		eq,
		ensureCrewForMember,
		expect,
		googleCalendarConnections,
		ids,
		organizationId,
		reconcileCalendarDeliveries,
		registeredUserId,
		route,
		shootAssignments,
		shootCalendarEvents,
		shoots,
		suffix,
		users,
	} = ctx;
	const linkedUserId = `calendar_link_user_${suffix}`;
	const linkedCrewId = `calendar_link_crew_${suffix}`;
	await db.insert(users).values({
		id: linkedUserId,
		name: "Linked crew",
		email: `linked-${suffix}@example.com`,
	});
	await db.insert(crews).values({
		id: linkedCrewId,
		organizationId,
		name: "Linked crew",
		email: `linked-${suffix}@example.com`,
	});
	await ensureCrewForMember({
		organizationId,
		userId: linkedUserId,
		source: "session_auto_heal",
	});
	const linkedCrew = await db.query.crews.findFirst({
		where: eq(crews.id, linkedCrewId),
	});
	const routeChange = await db.query.calendarRouteChanges.findFirst({
		where: and(
			eq(calendarRouteChanges.organizationId, organizationId),
			eq(calendarRouteChanges.crewId, linkedCrewId),
		),
	});
	expect(linkedCrew?.userId).toBe(linkedUserId);
	expect(routeChange).toMatchObject({
		reason: "crew_user_linked",
		status: "pending",
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
	const unrelatedRouteChange = await db.query.calendarRouteChanges.findFirst({
		where: eq(calendarRouteChanges.id, routeChange?.id ?? ""),
	});
	expect(unrelatedRouteChange).toMatchObject({ status: "pending" });
	const mapping = await db.query.shootCalendarEvents.findFirst({
		where: and(
			eq(shootCalendarEvents.organizationId, organizationId),
			eq(shootCalendarEvents.shootId, ids.registeredIcs),
		),
	});
	const jobs = await db
		.select()
		.from(calendarSyncJobs)
		.where(eq(calendarSyncJobs.shootId, ids.registeredIcs));
	const firstJob = jobs.find(
		(job: any) => job.generation === mapping?.intentGeneration,
	);
	expect(mapping).toMatchObject({
		deliveryMethod: "google",
		intentGeneration: 2,
	});
	const firstConnectionId = (firstJob?.payload as any).target
		.googleConnectionId as string;
	await db
		.update(googleCalendarConnections)
		.set({ disconnectedAt: new Date() })
		.where(eq(googleCalendarConnections.id, firstConnectionId));
	const [second] = await db
		.insert(googleCalendarConnections)
		.values({
			organizationId,
			userId: registeredUserId,
			version: 2,
			googleAccountEmail: `second-${suffix}@example.com`,
			refreshToken: "encrypted-second-test-token",
		})
		.returning();
	await reconcileCalendarDeliveries({
		organizationId,
		crewId: ids.registeredIcs,
		apply: true,
	});
	const intent = await db.query.calendarDeliveryIntents.findFirst({
		where: and(
			eq(calendarDeliveryIntents.organizationId, organizationId),
			eq(calendarDeliveryIntents.shootId, ids.registeredIcs),
			eq(calendarDeliveryIntents.generation, 3),
		),
	});
	expect(intent).toMatchObject({
		googleConnectionId: second?.id,
		googleAccountEmail: `second-${suffix}@example.com`,
	});
	expect((intent?.payload as any).target.googleConnectionId).toBe(second?.id);
	expect(firstConnectionId).not.toBe(second?.id);

	const legacy = {
		ics: `calendar_active_legacy_ics_${suffix}`,
		icsUser: `calendar_active_legacy_ics_user_${suffix}`,
		google: `calendar_active_legacy_google_${suffix}`,
		googleUser: `calendar_active_legacy_google_user_${suffix}`,
		ambiguous: `calendar_active_legacy_ambiguous_${suffix}`,
		ambiguousUser: `calendar_active_legacy_ambiguous_user_${suffix}`,
	};
	await db.insert(users).values([
		{
			id: legacy.googleUser,
			name: "Legacy Google user",
			email: `${legacy.googleUser}@example.com`,
		},
		{
			id: legacy.ambiguousUser,
			name: "Ambiguous legacy Google user",
			email: `${legacy.ambiguousUser}@example.com`,
		},
	]);
	await db.insert(crews).values([
		{
			id: legacy.ics,
			organizationId,
			name: "Legacy ICS crew",
			email: `${legacy.ics}@example.com`,
		},
		{
			id: legacy.google,
			organizationId,
			userId: legacy.googleUser,
			name: "Legacy Google crew",
			email: `${legacy.google}@example.com`,
		},
		{
			id: legacy.ambiguous,
			organizationId,
			userId: legacy.ambiguousUser,
			name: "Ambiguous legacy Google crew",
			email: `${legacy.ambiguous}@example.com`,
		},
	]);
	await db.insert(shoots).values(
		[legacy.ics, legacy.google, legacy.ambiguous].map((id) => ({
			id,
			organizationId,
			bookingId,
			name: `Active legacy ${id}`,
			shootType: "wedding",
			shootDate: "2027-02-20",
			startTime: "10:00",
			status: "scheduled",
		})),
	);
	await db.insert(shootAssignments).values(
		[legacy.ics, legacy.google, legacy.ambiguous].map((id) => ({
			shootId: id,
			crewId: id,
			role: "Photographer",
		})),
	);
	const [legacyGoogleConnection] = await db
		.insert(googleCalendarConnections)
		.values({
			organizationId,
			userId: legacy.googleUser,
			googleAccountEmail: `${legacy.googleUser}@calendar.example.com`,
			refreshToken: "encrypted-legacy-google-token",
		})
		.returning();
	await db.insert(googleCalendarConnections).values([
		{
			organizationId,
			userId: legacy.ambiguousUser,
			version: 1,
			googleAccountEmail: "old-account@example.com",
			refreshToken: "encrypted-old-ambiguous-token",
			disconnectedAt: new Date("2026-01-01T00:00:00.000Z"),
		},
		{
			organizationId,
			userId: legacy.ambiguousUser,
			version: 2,
			googleAccountEmail: "new-account@example.com",
			refreshToken: "encrypted-new-ambiguous-token",
		},
	]);
	await db.insert(shootCalendarEvents).values([
		{
			organizationId,
			shootId: legacy.ics,
			crewId: legacy.ics,
			deliveryMethod: "ics",
			recipientEmail: `${legacy.ics}@example.com`,
			icalUid: `legacy-${legacy.ics}@example.invalid`,
			icalSequence: 4,
			syncStatus: "synced",
			deliverySyncStatus: "synced",
		},
		{
			organizationId,
			shootId: legacy.google,
			crewId: legacy.google,
			deliveryMethod: "google",
			calendarId: "primary",
			googleEventId: `event-${legacy.google}`,
			syncStatus: "synced",
			deliverySyncStatus: "synced",
		},
		{
			organizationId,
			shootId: legacy.ambiguous,
			crewId: legacy.ambiguous,
			deliveryMethod: "google",
			calendarId: "primary",
			googleEventId: `event-${legacy.ambiguous}`,
			syncStatus: "synced",
			deliverySyncStatus: "synced",
		},
	]);

	await expect(route(legacy.ics)).resolves.toMatchObject({
		jobType: "ics_send_update",
	});
	await expect(route(legacy.google)).resolves.toMatchObject({
		jobType: "google_update",
	});
	const legacyGoogleUpdate = await db.query.calendarSyncJobs.findFirst({
		where: and(
			eq(calendarSyncJobs.shootId, legacy.google),
			eq(calendarSyncJobs.jobType, "google_update"),
		),
	});
	expect(legacyGoogleUpdate?.payload).toMatchObject({
		target: {
			googleConnectionId: legacyGoogleConnection?.id,
			googleEventId: `event-${legacy.google}`,
		},
	});
	expect(
		await db.query.shootCalendarEvents.findFirst({
			where: eq(shootCalendarEvents.shootId, legacy.google),
		}),
	).toMatchObject({
		calendarId: "primary",
		googleEventId: `event-${legacy.google}`,
	});

	await db.insert(users).values({
		id: legacy.icsUser,
		name: "Legacy ICS linked user",
		email: `${legacy.icsUser}@example.com`,
	});
	await db
		.update(crews)
		.set({ userId: legacy.icsUser })
		.where(eq(crews.id, legacy.ics));
	await db.insert(googleCalendarConnections).values({
		organizationId,
		userId: legacy.icsUser,
		refreshToken: "encrypted-legacy-ics-route-token",
	});
	await expect(route(legacy.ics)).resolves.toMatchObject({
		jobType: "google_create",
	});
	const legacyIcsCancellation = await db.query.calendarSyncJobs.findFirst({
		where: and(
			eq(calendarSyncJobs.shootId, legacy.ics),
			eq(calendarSyncJobs.jobType, "ics_send_cancel"),
		),
	});
	expect(legacyIcsCancellation?.payload).toMatchObject({
		target: {
			recipientEmail: `${legacy.ics}@example.com`,
			icalUid: `legacy-${legacy.ics}@example.invalid`,
			icalSequence: 5,
		},
	});

	await db
		.update(googleCalendarConnections)
		.set({ disconnectedAt: new Date() })
		.where(
			eq(googleCalendarConnections.id, legacyGoogleConnection?.id ?? ""),
		);
	await expect(route(legacy.google)).resolves.toMatchObject({
		jobType: "ics_send_invite",
	});
	const legacyGoogleCancellation = await db.query.calendarSyncJobs.findFirst({
		where: and(
			eq(calendarSyncJobs.shootId, legacy.google),
			eq(calendarSyncJobs.jobType, "google_delete"),
		),
	});
	expect(legacyGoogleCancellation?.payload).toMatchObject({
		target: {
			googleConnectionId: legacyGoogleConnection?.id,
			calendarId: "primary",
			googleEventId: `event-${legacy.google}`,
		},
	});

	await expect(route(legacy.ambiguous)).resolves.toMatchObject({
		state: "manual_reconciliation",
		jobType: null,
	});
	expect(
		await db.query.shootCalendarEvents.findFirst({
			where: eq(shootCalendarEvents.shootId, legacy.ambiguous),
		}),
	).toMatchObject({
		intentGeneration: 0,
		calendarId: "primary",
		googleEventId: `event-${legacy.ambiguous}`,
		cancellationSyncStatus: "manual_reconciliation",
	});
	expect(
		await db.query.calendarSyncJobs.findMany({
			where: eq(calendarSyncJobs.shootId, legacy.ambiguous),
		}),
	).toHaveLength(0);
}
