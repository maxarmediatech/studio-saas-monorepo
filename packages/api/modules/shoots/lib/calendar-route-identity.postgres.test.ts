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
		shootCalendarEvents,
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
}
