import {
	and,
	db,
	eq,
	isNotNull,
	isNull,
	ne,
	notifications,
	subscriptions,
} from "@repo/database";

interface NotifySubscribersInput {
	organizationId: string;
	entityType: string;
	entityId: string;
	entityName: string;
	type: string;
	title: string;
	body?: string;
	actorId?: string;
	actorName?: string;
	excludeUserId?: string;
}

interface AutoSubscribeInput {
	organizationId: string;
	userId: string;
	entityType: string;
	entityId: string;
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

export async function notifySubscribers({
	organizationId,
	entityType,
	entityId,
	entityName,
	type,
	title,
	body,
	actorId,
	actorName,
	excludeUserId,
}: NotifySubscribersInput) {
	const conditions = [
		eq(subscriptions.organizationId, organizationId),
		eq(subscriptions.entityType, entityType),
		eq(subscriptions.entityId, entityId),
		isNull(subscriptions.deletedAt),
	];

	if (excludeUserId) {
		conditions.push(ne(subscriptions.userId, excludeUserId));
	}

	const subscribersList = await db
		.select({ userId: subscriptions.userId })
		.from(subscriptions)
		.where(and(...conditions));

	if (subscribersList.length === 0) {
		return 0;
	}

	await db.insert(notifications).values(
		subscribersList.map((subscriber) => ({
			organizationId,
			userId: subscriber.userId,
			entityType,
			entityId,
			entityName,
			type,
			title,
			body: body ?? null,
			actorId: actorId ?? null,
			actorName: actorName ?? null,
		})),
	);

	return subscribersList.length;
}

export async function safeNotifySubscribers(input: NotifySubscribersInput) {
	try {
		return await notifySubscribers(input);
	} catch (error) {
		console.error("Notification dispatch failed:", error);
		return 0;
	}
}
