import { and, count, db, eq, isNull, notifications } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { unreadNotificationCountOutputSchema } from "../../studio/schemas/notification";

export const getUnreadNotificationCount = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/notifications/unread-count",
		tags: ["Notifications"],
		summary: "Get unread notification count",
		description: "Get unread notification count for the current user",
	})
	.output(unreadNotificationCountOutputSchema)
	.handler(async ({ context }) => {
		const [result] = await db
			.select({ count: count().mapWith(Number) })
			.from(notifications)
			.where(
				and(
					eq(notifications.organizationId, context.organizationId),
					eq(notifications.userId, context.user.id),
					isNull(notifications.readAt),
				),
			);

		return { count: result?.count ?? 0 };
	});
