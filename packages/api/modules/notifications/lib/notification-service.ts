import {
	and,
	crews,
	db,
	deliverableAssignments,
	deliverables,
	eq,
	inArray,
	isNotNull,
	isNull,
	ne,
	notificationPreferences,
	notifications,
	shootAssignments,
	shoots,
	sql,
	subscriptions,
	taskAssignments,
	tasks,
} from "@repo/database";
import { isDeadlineReminderMetadata } from "./notification-metadata";
import {
	getEffectiveNotificationPreferences,
	shouldNotifyForReasons,
} from "./notification-preferences";
import {
	buildRecipientReasons,
	type EntityNotificationContext,
	type NotificationEntityType,
	type NotifyEntityUsersInput,
} from "./recipient-rules";

interface AutoSubscribeInput {
	organizationId: string;
	userId: string;
	entityType: string;
	entityId: string;
}

async function getSubscribers(
	organizationId: string,
	entityType: NotificationEntityType,
	entityId: string,
	excludeUserId?: string,
) {
	const conditions = [
		eq(subscriptions.organizationId, organizationId),
		eq(subscriptions.entityType, entityType),
		eq(subscriptions.entityId, entityId),
		isNull(subscriptions.deletedAt),
	];

	if (excludeUserId) {
		conditions.push(ne(subscriptions.userId, excludeUserId));
	}

	return db
		.select({ userId: subscriptions.userId })
		.from(subscriptions)
		.where(and(...conditions));
}

async function getTaskNotificationContext(
	organizationId: string,
	entityId: string,
): Promise<EntityNotificationContext> {
	const task = await db.query.tasks.findFirst({
		where: and(
			eq(tasks.organizationId, organizationId),
			eq(tasks.id, entityId),
			isNull(tasks.deletedAt),
		),
		with: {
			booking: {
				columns: { createdBy: true },
			},
		},
		columns: { id: true },
	});

	const assignments = await db
		.select({
			userId: crews.userId,
			assignedBy: taskAssignments.assignedBy,
		})
		.from(taskAssignments)
		.innerJoin(crews, eq(taskAssignments.crewId, crews.id))
		.where(eq(taskAssignments.taskId, entityId));

	return {
		assignerUserIds: [
			...new Set(
				assignments
					.map((assignment) => assignment.assignedBy)
					.filter((userId): userId is string => Boolean(userId)),
			),
		],
		assigneeUserIds: [
			...new Set(
				assignments
					.map((assignment) => assignment.userId)
					.filter((userId): userId is string => Boolean(userId)),
			),
		],
		bookingOwnerUserId: task?.booking.createdBy ?? null,
	};
}

async function getDeliverableNotificationContext(
	organizationId: string,
	entityId: string,
): Promise<EntityNotificationContext> {
	const deliverable = await db.query.deliverables.findFirst({
		where: and(
			eq(deliverables.organizationId, organizationId),
			eq(deliverables.id, entityId),
			isNull(deliverables.deletedAt),
		),
		with: {
			booking: {
				columns: { createdBy: true },
			},
		},
		columns: { id: true },
	});

	const assignments = await db
		.select({
			userId: crews.userId,
			assignedBy: deliverableAssignments.assignedBy,
		})
		.from(deliverableAssignments)
		.innerJoin(crews, eq(deliverableAssignments.crewId, crews.id))
		.where(eq(deliverableAssignments.deliverableId, entityId));

	return {
		assignerUserIds: [
			...new Set(
				assignments
					.map((assignment) => assignment.assignedBy)
					.filter((userId): userId is string => Boolean(userId)),
			),
		],
		assigneeUserIds: [
			...new Set(
				assignments
					.map((assignment) => assignment.userId)
					.filter((userId): userId is string => Boolean(userId)),
			),
		],
		bookingOwnerUserId: deliverable?.booking.createdBy ?? null,
	};
}

async function getShootNotificationContext(
	organizationId: string,
	entityId: string,
): Promise<EntityNotificationContext> {
	const shoot = await db.query.shoots.findFirst({
		where: and(
			eq(shoots.organizationId, organizationId),
			eq(shoots.id, entityId),
			isNull(shoots.deletedAt),
		),
		with: {
			booking: {
				columns: { createdBy: true },
			},
		},
		columns: { id: true },
	});

	const assignments = await db
		.select({
			userId: crews.userId,
			assignedBy: shootAssignments.assignedBy,
		})
		.from(shootAssignments)
		.innerJoin(crews, eq(shootAssignments.crewId, crews.id))
		.where(eq(shootAssignments.shootId, entityId));

	return {
		assignerUserIds: [
			...new Set(
				assignments
					.map((assignment) => assignment.assignedBy)
					.filter((userId): userId is string => Boolean(userId)),
			),
		],
		assigneeUserIds: [
			...new Set(
				assignments
					.map((assignment) => assignment.userId)
					.filter((userId): userId is string => Boolean(userId)),
			),
		],
		bookingOwnerUserId: shoot?.booking.createdBy ?? null,
	};
}

async function getEntityNotificationContext(
	organizationId: string,
	entityType: NotificationEntityType,
	entityId: string,
): Promise<EntityNotificationContext> {
	switch (entityType) {
		case "task":
			return getTaskNotificationContext(organizationId, entityId);
		case "deliverable":
			return getDeliverableNotificationContext(organizationId, entityId);
		case "shoot":
			return getShootNotificationContext(organizationId, entityId);
	}
}

async function filterDuplicateReminderRecipients(
	input: NotifyEntityUsersInput,
	recipients: string[],
) {
	const reminderMetadata = input.metadata ?? null;

	if (
		!isDeadlineReminderMetadata(reminderMetadata) ||
		recipients.length === 0
	) {
		return recipients;
	}

	const existingRows = await db
		.select({ userId: notifications.userId })
		.from(notifications)
		.where(
			and(
				eq(notifications.organizationId, input.organizationId),
				eq(notifications.entityType, input.entityType),
				eq(notifications.entityId, input.entityId),
				eq(notifications.type, input.type),
				inArray(notifications.userId, recipients),
				sql`${notifications.metadata} ->> 'kind' = ${reminderMetadata.kind}`,
				sql`${notifications.metadata} ->> 'dueDate' = ${reminderMetadata.dueDate}`,
			),
		);

	const existingUserIds = new Set(existingRows.map((row) => row.userId));
	return recipients.filter((userId) => !existingUserIds.has(userId));
}

async function getPreferenceMap(organizationId: string, userIds: string[]) {
	if (userIds.length === 0) {
		return new Map<
			string,
			ReturnType<typeof getEffectiveNotificationPreferences>
		>();
	}

	const rows = await db
		.select({
			userId: notificationPreferences.userId,
			assignedToMe: notificationPreferences.assignedToMe,
			itemsIAssigned: notificationPreferences.itemsIAssigned,
			bookingsIOwn: notificationPreferences.bookingsIOwn,
			itemsIFollow: notificationPreferences.itemsIFollow,
			mentions: notificationPreferences.mentions,
			dueOverdueReminders: notificationPreferences.dueOverdueReminders,
		})
		.from(notificationPreferences)
		.where(
			and(
				eq(notificationPreferences.organizationId, organizationId),
				inArray(notificationPreferences.userId, userIds),
			),
		);

	return new Map(
		rows.map((row) => [
			row.userId,
			getEffectiveNotificationPreferences(row),
		]),
	);
}

export async function autoSubscribe({
	organizationId,
	userId,
	entityType,
	entityId,
}: AutoSubscribeInput) {
	const existing = await db.query.subscriptions.findFirst({
		where: and(
			eq(subscriptions.organizationId, organizationId),
			eq(subscriptions.userId, userId),
			eq(subscriptions.entityType, entityType),
			eq(subscriptions.entityId, entityId),
			isNull(subscriptions.deletedAt),
		),
		columns: { id: true },
	});

	if (existing) {
		return existing.id;
	}

	const restored = await db
		.update(subscriptions)
		.set({ deletedAt: null })
		.where(
			and(
				eq(subscriptions.organizationId, organizationId),
				eq(subscriptions.userId, userId),
				eq(subscriptions.entityType, entityType),
				eq(subscriptions.entityId, entityId),
				isNotNull(subscriptions.deletedAt),
			),
		)
		.returning({ id: subscriptions.id });

	if (restored.length > 0) {
		return restored[0]?.id ?? null;
	}

	const [created] = await db
		.insert(subscriptions)
		.values({
			organizationId,
			userId,
			entityType,
			entityId,
		})
		.returning({ id: subscriptions.id });

	return created?.id ?? null;
}

export async function safeAutoSubscribe(input: AutoSubscribeInput) {
	try {
		return await autoSubscribe(input);
	} catch (error) {
		console.error("Auto-subscribe failed:", error);
		return null;
	}
}

export async function notifyEntityUsers(input: NotifyEntityUsersInput) {
	const [subscribersList, context] = await Promise.all([
		getSubscribers(
			input.organizationId,
			input.entityType,
			input.entityId,
			input.excludeUserId,
		),
		getEntityNotificationContext(
			input.organizationId,
			input.entityType,
			input.entityId,
		),
	]);

	const recipientReasons = buildRecipientReasons(
		input,
		context,
		subscribersList.map((subscriber) => subscriber.userId),
	);
	const candidateUserIds = [...recipientReasons.keys()].filter(
		(userId) => userId !== input.excludeUserId,
	);

	if (candidateUserIds.length === 0) {
		return 0;
	}

	const preferencesByUserId = await getPreferenceMap(
		input.organizationId,
		candidateUserIds,
	);
	const recipients = candidateUserIds.filter((userId) =>
		shouldNotifyForReasons(
			preferencesByUserId.get(userId) ??
				getEffectiveNotificationPreferences(),
			recipientReasons.get(userId) ?? [],
		),
	);

	const dedupedRecipients = await filterDuplicateReminderRecipients(
		input,
		recipients,
	);

	if (dedupedRecipients.length === 0) {
		return 0;
	}

	await db.insert(notifications).values(
		dedupedRecipients.map((userId) => ({
			organizationId: input.organizationId,
			userId,
			entityType: input.entityType,
			entityId: input.entityId,
			entityName: input.entityName,
			type: input.type,
			title: input.title,
			body: input.body ?? null,
			metadata: input.metadata ?? null,
			actorId: input.actorId ?? null,
			actorName: input.actorName ?? null,
		})),
	);

	return dedupedRecipients.length;
}

export async function safeNotifyEntityUsers(input: NotifyEntityUsersInput) {
	try {
		return await notifyEntityUsers(input);
	} catch (error) {
		console.error("Notification dispatch failed:", error);
		return 0;
	}
}

export const notifySubscribers = notifyEntityUsers;
export const safeNotifySubscribers = safeNotifyEntityUsers;
