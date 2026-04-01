import { ORPCError } from "@orpc/server";
import { and, db, eq, notifications } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	markNotificationUnreadInputSchema,
	markNotificationUnreadOutputSchema,
} from "../../studio/schemas/notification";

export const markNotificationUnread = studioProtectedProcedure
	.route({
		method: "PATCH",
		path: "/notifications/{id}/unread",
		tags: ["Notifications"],
		summary: "Mark notification as unread",
		description: "Mark a notification as unread for the current user",
	})
	.input(markNotificationUnreadInputSchema)
	.output(markNotificationUnreadOutputSchema)
	.handler(async ({ input, context }) => {
		const { id } = input;

		const existing = await db.query.notifications.findFirst({
			where: and(
				eq(notifications.id, id),
				eq(notifications.organizationId, context.organizationId),
				eq(notifications.userId, context.user.id),
			),
			columns: { id: true },
		});

		if (!existing) {
			throw new ORPCError("NOT_FOUND", {
				message: "Notification not found",
			});
		}

		await db
			.update(notifications)
			.set({ readAt: null })
			.where(
				and(
					eq(notifications.id, id),
					eq(notifications.organizationId, context.organizationId),
					eq(notifications.userId, context.user.id),
				),
			);

		return {
			data: { id },
			message: "Notification marked as unread",
		};
	});
