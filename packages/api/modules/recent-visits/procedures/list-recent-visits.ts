import {
	and,
	bookings,
	db,
	deliverables,
	desc,
	eq,
	inArray,
	isNull,
	recentVisits,
	shoots,
	tasks,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { hasPermission } from "../../studio/lib/permissions";
import {
	listRecentVisitsInputSchema,
	listRecentVisitsOutputSchema,
	type RecentVisitItem,
} from "../schemas";

export const listRecentVisits = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/recent-visits",
		tags: ["Recent Visits"],
		summary: "List recent visits",
		description: "Get user's recently visited entities with hydrated data",
	})
	.input(listRecentVisitsInputSchema)
	.output(listRecentVisitsOutputSchema)
	.handler(async ({ input, context }) => {
		const { entityType, limit } = input;
		const { organizationId, user } = context;
		const userId = user.id;
		const [
			canReadBookings,
			canReadShoots,
			canReadTasks,
			canReadDeliverables,
		] = await Promise.all([
			hasPermission(context, "booking", "list"),
			hasPermission(context, "shoot", "list"),
			hasPermission(context, "task", "list"),
			hasPermission(context, "deliverable", "list"),
		]);
		const allowedEntityTypes = new Set(
			[
				canReadBookings ? "booking" : null,
				canReadShoots ? "shoot" : null,
				canReadTasks ? "task" : null,
				canReadDeliverables ? "deliverable" : null,
			].filter(
				(
					value,
				): value is "booking" | "shoot" | "task" | "deliverable" =>
					value !== null,
			),
		);

		if (entityType !== "all" && !allowedEntityTypes.has(entityType)) {
			return { data: [] };
		}

		const conditions = [
			eq(recentVisits.organizationId, organizationId),
			eq(recentVisits.userId, userId),
		];

		if (entityType !== "all") {
			conditions.push(eq(recentVisits.entityType, entityType));
		}

		const visits = await db
			.select()
			.from(recentVisits)
			.where(and(...conditions))
			.orderBy(desc(recentVisits.visitedAt), desc(recentVisits.id))
			.limit(limit * 2);

		if (visits.length === 0) {
			return { data: [] };
		}

		const grouped: Record<string, string[]> = {
			booking: [],
			shoot: [],
			task: [],
			deliverable: [],
		};

		for (const visit of visits) {
			if (
				visit.entityType in grouped &&
				allowedEntityTypes.has(
					visit.entityType as
						| "booking"
						| "shoot"
						| "task"
						| "deliverable",
				)
			) {
				grouped[visit.entityType].push(visit.entityId);
			}
		}

		const [bookingsData, shootsData, tasksData, deliverablesData] =
			await Promise.all([
				grouped.booking.length > 0
					? db
							.select({
								id: bookings.id,
								name: bookings.name,
								status: bookings.status,
								referenceNumber: bookings.referenceNumber,
							})
							.from(bookings)
							.where(
								and(
									inArray(bookings.id, grouped.booking),
									eq(bookings.organizationId, organizationId),
									isNull(bookings.deletedAt),
								),
							)
					: [],
				grouped.shoot.length > 0
					? db
							.select({
								id: shoots.id,
								name: shoots.name,
								status: shoots.status,
								bookingId: shoots.bookingId,
							})
							.from(shoots)
							.where(
								and(
									inArray(shoots.id, grouped.shoot),
									eq(shoots.organizationId, organizationId),
									isNull(shoots.deletedAt),
								),
							)
					: [],
				grouped.task.length > 0
					? db
							.select({
								id: tasks.id,
								name: tasks.name,
								status: tasks.status,
								bookingId: tasks.bookingId,
							})
							.from(tasks)
							.where(
								and(
									inArray(tasks.id, grouped.task),
									eq(tasks.organizationId, organizationId),
									isNull(tasks.deletedAt),
								),
							)
					: [],
				grouped.deliverable.length > 0
					? db
							.select({
								id: deliverables.id,
								name: deliverables.name,
								status: deliverables.status,
								bookingId: deliverables.bookingId,
							})
							.from(deliverables)
							.where(
								and(
									inArray(
										deliverables.id,
										grouped.deliverable,
									),
									eq(
										deliverables.organizationId,
										organizationId,
									),
									isNull(deliverables.deletedAt),
								),
							)
					: [],
			]);

		const entityMap = new Map<string, Record<string, unknown>>();

		for (const b of bookingsData) {
			entityMap.set(`booking:${b.id}`, b);
		}
		for (const s of shootsData) {
			entityMap.set(`shoot:${s.id}`, s);
		}
		for (const t of tasksData) {
			entityMap.set(`task:${t.id}`, t);
		}
		for (const d of deliverablesData) {
			entityMap.set(`deliverable:${d.id}`, d);
		}

		const data: RecentVisitItem[] = visits
			.map((visit) => {
				const entityData = entityMap.get(
					`${visit.entityType}:${visit.entityId}`,
				);
				return {
					id: visit.id,
					entityType: visit.entityType,
					entityId: visit.entityId,
					visitedAt: visit.visitedAt.toISOString(),
					entityData: entityData
						? {
								id: entityData.id as string,
								name: entityData.name as string,
								status: entityData.status as string | undefined,
								referenceNumber: entityData.referenceNumber as
									| string
									| undefined,
								bookingId: entityData.bookingId as
									| string
									| undefined,
							}
						: null,
				};
			})
			.filter((item) => item.entityData !== null)
			.slice(0, limit);

		return { data };
	});
