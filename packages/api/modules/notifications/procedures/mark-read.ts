import { ORPCError } from "@orpc/server";
import { and, db, eq, notifications } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	markNotificationReadInputSchema,
	markNotificationReadOutputSchema,
} from "../../studio/schemas/notification";

export const markNotificationRead = studioProtectedProcedure
	.route({
		method: "PATCH",
		path: "/notifications/{id}/read",
		tags: ["Notifications"],
		summary: "Mark notification as read",
		description: "Mark a notification as read for the current user",
	})
	.input(markNotificationReadInputSchema)
	.output(markNotificationReadOutputSchema)
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
			.set({ readAt: new Date() })
			.where(
				and(
					eq(notifications.id, id),
					eq(notifications.organizationId, context.organizationId),
					eq(notifications.userId, context.user.id),
				),
			);

		return {
			data: { id },
			message: "Notification marked as read",
		};
	});
