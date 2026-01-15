import {
	and,
	bookings,
	crews,
	db,
	deliverableAssignments,
	deliverables,
	eq,
	inArray,
	isNull,
	shootAssignments,
	shoots,
	subscriptions,
	taskAssignments,
	tasks,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { createPaginationResponse } from "../../studio/schemas/common";
import {
	listYourWorkInputSchema,
	listYourWorkOutputSchema,
	type YourWorkEntityType,
	type YourWorkItem,
} from "../../studio/schemas/your-work";

function buildItemId(entityType: YourWorkEntityType, entityId: string) {
	return `${entityType}:${entityId}`;
}

function sortWorkItems(items: YourWorkItem[]) {
	return items.sort((a, b) => {
		const aTime = a.date ? new Date(a.date).getTime() : Number.POSITIVE_INFINITY;
		const bTime = b.date ? new Date(b.date).getTime() : Number.POSITIVE_INFINITY;
		if (aTime !== bTime) {
			return aTime - bTime;
		}
		return a.name.localeCompare(b.name);
	});
}

export const listYourWork = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/your-work",
		tags: ["Your Work"],
		summary: "List your work items",
		description: "Unified list of assigned, created, and subscribed items",
	})
	.input(listYourWorkInputSchema)
	.output(listYourWorkOutputSchema)
	.handler(async ({ input, context }) => {
		const { view, entityType, page, limit } = input;
		const { organizationId, user } = context;
		const userId = user.id;
		const offset = (page - 1) * limit;

		const includeTasks = entityType === "all" || entityType === "task";
		const includeDeliverables =
			entityType === "all" || entityType === "deliverable";
		const includeShoots = entityType === "all" || entityType === "shoot";

		const crew = await db.query.crews.findFirst({
			where: and(
				eq(crews.organizationId, organizationId),
				eq(crews.userId, userId),
				isNull(crews.deletedAt),
			),
			columns: { id: true },
		});
		const crewId = crew?.id ?? null;

		const items: YourWorkItem[] = [];

		const loadSubscriptionSet = async (
			type: YourWorkEntityType,
			ids: string[],
		) => {
			if (ids.length === 0) {
				return new Set<string>();
			}
			const rows = await db
				.select({ entityId: subscriptions.entityId })
				.from(subscriptions)
				.where(
					and(
						eq(subscriptions.organizationId, organizationId),
						eq(subscriptions.userId, userId),
						eq(subscriptions.entityType, type),
						isNull(subscriptions.deletedAt),
						inArray(subscriptions.entityId, ids),
					),
				);
			return new Set(rows.map((row) => row.entityId));
		};

		if (view === "assigned") {
			if (!crewId) {
				return {
					data: [],
					pagination: createPaginationResponse(page, limit, 0),
				};
			}

			const [taskRows, deliverableRows, shootRows] = await Promise.all([
				includeTasks
					? db
							.select({
								id: tasks.id,
								name: tasks.name,
								status: tasks.status,
								dueDate: tasks.dueDate,
								bookingId: tasks.bookingId,
								bookingName: bookings.name,
							})
							.from(taskAssignments)
							.innerJoin(tasks, eq(taskAssignments.taskId, tasks.id))
							.innerJoin(bookings, eq(tasks.bookingId, bookings.id))
							.where(
								and(
									eq(taskAssignments.crewId, crewId),
									eq(tasks.organizationId, organizationId),
									isNull(tasks.deletedAt),
								),
							)
					: [],
				includeDeliverables
					? db
							.select({
								id: deliverables.id,
								name: deliverables.name,
								status: deliverables.status,
								dueDate: deliverables.dueDate,
								bookingId: deliverables.bookingId,
								bookingName: bookings.name,
							})
							.from(deliverableAssignments)
							.innerJoin(
								deliverables,
								eq(
									deliverableAssignments.deliverableId,
									deliverables.id,
								),
							)
							.innerJoin(
								bookings,
								eq(deliverables.bookingId, bookings.id),
							)
							.where(
								and(
									eq(deliverableAssignments.crewId, crewId),
									eq(deliverables.organizationId, organizationId),
									isNull(deliverables.deletedAt),
								),
							)
					: [],
				includeShoots
					? db
							.select({
								id: shoots.id,
								name: shoots.name,
								status: shoots.status,
								shootDate: shoots.shootDate,
								bookingId: shoots.bookingId,
								bookingName: bookings.name,
							})
							.from(shootAssignments)
							.innerJoin(
								shoots,
								eq(shootAssignments.shootId, shoots.id),
							)
							.innerJoin(
								bookings,
								eq(shoots.bookingId, bookings.id),
							)
							.where(
								and(
									eq(shootAssignments.crewId, crewId),
									eq(shoots.organizationId, organizationId),
									isNull(shoots.deletedAt),
								),
							)
					: [],
			]);

			const taskIds = taskRows.map((row) => row.id);
			const deliverableIds = deliverableRows.map((row) => row.id);
			const shootIds = shootRows.map((row) => row.id);

			const [taskSubscriptions, deliverableSubscriptions, shootSubscriptions] =
				await Promise.all([
					loadSubscriptionSet("task", taskIds),
					loadSubscriptionSet("deliverable", deliverableIds),
					loadSubscriptionSet("shoot", shootIds),
				]);

			for (const row of taskRows) {
				items.push({
					id: buildItemId("task", row.id),
					entityType: "task",
					entityId: row.id,
					name: row.name,
					status: row.status,
					date: row.dueDate ?? null,
					bookingId: row.bookingId,
					bookingName: row.bookingName,
					isSubscribed: taskSubscriptions.has(row.id),
				});
			}
			for (const row of deliverableRows) {
				items.push({
					id: buildItemId("deliverable", row.id),
					entityType: "deliverable",
					entityId: row.id,
					name: row.name,
					status: row.status,
					date: row.dueDate ?? null,
					bookingId: row.bookingId,
					bookingName: row.bookingName,
					isSubscribed: deliverableSubscriptions.has(row.id),
				});
			}
			for (const row of shootRows) {
				items.push({
					id: buildItemId("shoot", row.id),
					entityType: "shoot",
					entityId: row.id,
					name: row.name,
					status: row.status,
					date: row.shootDate ?? null,
					bookingId: row.bookingId,
					bookingName: row.bookingName,
					isSubscribed: shootSubscriptions.has(row.id),
				});
			}
		} else if (view === "created") {
			const [taskRows, deliverableRows, shootRows] = await Promise.all([
				includeTasks
					? db
							.select({
								id: tasks.id,
								name: tasks.name,
								status: tasks.status,
								dueDate: tasks.dueDate,
								bookingId: tasks.bookingId,
								bookingName: bookings.name,
							})
							.from(tasks)
							.innerJoin(bookings, eq(tasks.bookingId, bookings.id))
							.where(
								and(
									eq(tasks.organizationId, organizationId),
									eq(tasks.createdBy, userId),
									isNull(tasks.deletedAt),
								),
							)
					: [],
				includeDeliverables
					? db
							.select({
								id: deliverables.id,
								name: deliverables.name,
								status: deliverables.status,
								dueDate: deliverables.dueDate,
								bookingId: deliverables.bookingId,
								bookingName: bookings.name,
							})
							.from(deliverables)
							.innerJoin(
								bookings,
								eq(deliverables.bookingId, bookings.id),
							)
							.where(
								and(
									eq(deliverables.organizationId, organizationId),
									eq(deliverables.createdBy, userId),
									isNull(deliverables.deletedAt),
								),
							)
					: [],
				includeShoots
					? db
							.select({
								id: shoots.id,
								name: shoots.name,
								status: shoots.status,
								shootDate: shoots.shootDate,
								bookingId: shoots.bookingId,
								bookingName: bookings.name,
							})
							.from(shoots)
							.innerJoin(
								bookings,
								eq(shoots.bookingId, bookings.id),
							)
							.where(
								and(
									eq(shoots.organizationId, organizationId),
									eq(shoots.createdBy, userId),
									isNull(shoots.deletedAt),
								),
							)
					: [],
			]);

			const taskIds = taskRows.map((row) => row.id);
			const deliverableIds = deliverableRows.map((row) => row.id);
			const shootIds = shootRows.map((row) => row.id);

			const [taskSubscriptions, deliverableSubscriptions, shootSubscriptions] =
				await Promise.all([
					loadSubscriptionSet("task", taskIds),
					loadSubscriptionSet("deliverable", deliverableIds),
					loadSubscriptionSet("shoot", shootIds),
				]);

			for (const row of taskRows) {
				items.push({
					id: buildItemId("task", row.id),
					entityType: "task",
					entityId: row.id,
					name: row.name,
					status: row.status,
					date: row.dueDate ?? null,
					bookingId: row.bookingId,
					bookingName: row.bookingName,
					isSubscribed: taskSubscriptions.has(row.id),
				});
			}
			for (const row of deliverableRows) {
				items.push({
					id: buildItemId("deliverable", row.id),
					entityType: "deliverable",
					entityId: row.id,
					name: row.name,
					status: row.status,
					date: row.dueDate ?? null,
					bookingId: row.bookingId,
					bookingName: row.bookingName,
					isSubscribed: deliverableSubscriptions.has(row.id),
				});
			}
			for (const row of shootRows) {
				items.push({
					id: buildItemId("shoot", row.id),
					entityType: "shoot",
					entityId: row.id,
					name: row.name,
					status: row.status,
					date: row.shootDate ?? null,
					bookingId: row.bookingId,
					bookingName: row.bookingName,
					isSubscribed: shootSubscriptions.has(row.id),
				});
			}
		} else {
			const subscriptionConditions = [
				eq(subscriptions.organizationId, organizationId),
				eq(subscriptions.userId, userId),
				isNull(subscriptions.deletedAt),
			];

			if (entityType !== "all") {
				subscriptionConditions.push(
					eq(subscriptions.entityType, entityType),
				);
			}

			const subscriptionRows = await db
				.select({
					entityType: subscriptions.entityType,
					entityId: subscriptions.entityId,
				})
				.from(subscriptions)
				.where(and(...subscriptionConditions));

			const taskIds = subscriptionRows
				.filter((row) => row.entityType === "task")
				.map((row) => row.entityId);
			const deliverableIds = subscriptionRows
				.filter((row) => row.entityType === "deliverable")
				.map((row) => row.entityId);
			const shootIds = subscriptionRows
				.filter((row) => row.entityType === "shoot")
				.map((row) => row.entityId);

			const [assignedTaskIds, assignedDeliverableIds, assignedShootIds] =
				await Promise.all([
					crewId && taskIds.length > 0
						? db
								.select({ taskId: taskAssignments.taskId })
								.from(taskAssignments)
								.where(
									and(
										eq(taskAssignments.crewId, crewId),
										inArray(taskAssignments.taskId, taskIds),
									),
								)
						: [],
					crewId && deliverableIds.length > 0
						? db
								.select({
									deliverableId: deliverableAssignments.deliverableId,
								})
								.from(deliverableAssignments)
								.where(
									and(
										eq(deliverableAssignments.crewId, crewId),
										inArray(
											deliverableAssignments.deliverableId,
											deliverableIds,
										),
									),
								)
						: [],
					crewId && shootIds.length > 0
						? db
								.select({ shootId: shootAssignments.shootId })
								.from(shootAssignments)
								.where(
									and(
										eq(shootAssignments.crewId, crewId),
										inArray(shootAssignments.shootId, shootIds),
									),
								)
						: [],
				]);

			const assignedTaskSet = new Set(
				assignedTaskIds.map((row) => row.taskId),
			);
			const assignedDeliverableSet = new Set(
				assignedDeliverableIds.map((row) => row.deliverableId),
			);
			const assignedShootSet = new Set(
				assignedShootIds.map((row) => row.shootId),
			);

			const [taskRows, deliverableRows, shootRows] = await Promise.all([
				includeTasks && taskIds.length > 0
					? db
							.select({
								id: tasks.id,
								name: tasks.name,
								status: tasks.status,
								dueDate: tasks.dueDate,
								bookingId: tasks.bookingId,
								bookingName: bookings.name,
								createdBy: tasks.createdBy,
							})
							.from(tasks)
							.innerJoin(bookings, eq(tasks.bookingId, bookings.id))
							.where(
								and(
									eq(tasks.organizationId, organizationId),
									isNull(tasks.deletedAt),
									inArray(tasks.id, taskIds),
								),
							)
					: [],
				includeDeliverables && deliverableIds.length > 0
					? db
							.select({
								id: deliverables.id,
								name: deliverables.name,
								status: deliverables.status,
								dueDate: deliverables.dueDate,
								bookingId: deliverables.bookingId,
								bookingName: bookings.name,
								createdBy: deliverables.createdBy,
							})
							.from(deliverables)
							.innerJoin(
								bookings,
								eq(deliverables.bookingId, bookings.id),
							)
							.where(
								and(
									eq(deliverables.organizationId, organizationId),
									isNull(deliverables.deletedAt),
									inArray(deliverables.id, deliverableIds),
								),
							)
					: [],
				includeShoots && shootIds.length > 0
					? db
							.select({
								id: shoots.id,
								name: shoots.name,
								status: shoots.status,
								shootDate: shoots.shootDate,
								bookingId: shoots.bookingId,
								bookingName: bookings.name,
								createdBy: shoots.createdBy,
							})
							.from(shoots)
							.innerJoin(
								bookings,
								eq(shoots.bookingId, bookings.id),
							)
							.where(
								and(
									eq(shoots.organizationId, organizationId),
									isNull(shoots.deletedAt),
									inArray(shoots.id, shootIds),
								),
							)
					: [],
			]);

			for (const row of taskRows) {
				if (row.createdBy === userId || assignedTaskSet.has(row.id)) {
					continue;
				}
				items.push({
					id: buildItemId("task", row.id),
					entityType: "task",
					entityId: row.id,
					name: row.name,
					status: row.status,
					date: row.dueDate ?? null,
					bookingId: row.bookingId,
					bookingName: row.bookingName,
					isSubscribed: true,
				});
			}
			for (const row of deliverableRows) {
				if (
					row.createdBy === userId ||
					assignedDeliverableSet.has(row.id)
				) {
					continue;
				}
				items.push({
					id: buildItemId("deliverable", row.id),
					entityType: "deliverable",
					entityId: row.id,
					name: row.name,
					status: row.status,
					date: row.dueDate ?? null,
					bookingId: row.bookingId,
					bookingName: row.bookingName,
					isSubscribed: true,
				});
			}
			for (const row of shootRows) {
				if (row.createdBy === userId || assignedShootSet.has(row.id)) {
					continue;
				}
				items.push({
					id: buildItemId("shoot", row.id),
					entityType: "shoot",
					entityId: row.id,
					name: row.name,
					status: row.status,
					date: row.shootDate ?? null,
					bookingId: row.bookingId,
					bookingName: row.bookingName,
					isSubscribed: true,
				});
			}
		}

		const sorted = sortWorkItems(items);
		const total = sorted.length;
		const paginated = sorted.slice(offset, offset + limit);

		return {
			data: paginated,
			pagination: createPaginationResponse(page, limit, total),
		};
	});
