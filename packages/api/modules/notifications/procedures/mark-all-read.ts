import { and, db, eq, isNull, notifications } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { markAllNotificationsReadOutputSchema } from "../../studio/schemas/notification";

export const markAllNotificationsRead = studioProtectedProcedure
	.route({
		method: "PATCH",
		path: "/notifications/read-all",
		tags: ["Notifications"],
		summary: "Mark all notifications as read",
		description: "Mark all notifications as read for the current user",
	})
	.output(markAllNotificationsReadOutputSchema)
	.handler(async ({ context }) => {
		await db
			.update(notifications)
			.set({ readAt: new Date() })
			.where(
				and(
					eq(notifications.organizationId, context.organizationId),
					eq(notifications.userId, context.user.id),
					isNull(notifications.readAt),
				),
			);

		return { success: true };
	});
