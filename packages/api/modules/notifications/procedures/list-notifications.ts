import { and, count, db, desc, eq, isNull, notifications } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { createPaginationResponse } from "../../studio/schemas/common";
import {
	listNotificationsInputSchema,
	listNotificationsOutputSchema,
} from "../../studio/schemas/notification";

export const listNotifications = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/notifications",
		tags: ["Notifications"],
		summary: "List notifications",
		description: "Get notifications for the current user",
	})
	.input(listNotificationsInputSchema)
	.output(listNotificationsOutputSchema)
	.handler(async ({ input, context }) => {
		const { page, limit, unreadOnly } = input;
		const offset = (page - 1) * limit;

		const conditions = [
			eq(notifications.organizationId, context.organizationId),
			eq(notifications.userId, context.user.id),
		];

		if (unreadOnly) {
			conditions.push(isNull(notifications.readAt));
		}

		const [countResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(notifications)
			.where(and(...conditions));

		const total = countResult?.count ?? 0;

		const rows = await db
			.select()
			.from(notifications)
			.where(and(...conditions))
			.orderBy(desc(notifications.createdAt), desc(notifications.id))
			.limit(limit)
			.offset(offset);

		return {
			data: rows.map((row) => ({
				id: row.id,
				entityType: row.entityType as "task" | "deliverable" | "shoot",
				entityId: row.entityId,
				entityName: row.entityName,
				type: row.type,
				title: row.title,
				body: row.body ?? null,
				actorId: row.actorId ?? null,
				actorName: row.actorName ?? null,
				readAt: row.readAt?.toISOString() ?? null,
				createdAt: row.createdAt.toISOString(),
			})),
			pagination: createPaginationResponse(page, limit, total),
		};
	});
