import { and, db, eq, notificationPreferences } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	updateNotificationPreferencesInputSchema,
	updateNotificationPreferencesOutputSchema,
} from "../../studio/schemas/notification";

export const updateNotificationPreferences = studioProtectedProcedure
	.route({
		method: "PUT",
		path: "/notifications/preferences",
		tags: ["Notifications"],
		summary: "Update notification preferences",
		description:
			"Update in-app notification preferences for the current user",
	})
	.input(updateNotificationPreferencesInputSchema)
	.output(updateNotificationPreferencesOutputSchema)
	.handler(async ({ input, context }) => {
		const existing = await db.query.notificationPreferences.findFirst({
			where: and(
				eq(
					notificationPreferences.organizationId,
					context.organizationId,
				),
				eq(notificationPreferences.userId, context.user.id),
			),
			columns: { id: true },
		});

		if (existing) {
			await db
				.update(notificationPreferences)
				.set({
					...input,
					updatedAt: new Date(),
				})
				.where(eq(notificationPreferences.id, existing.id));
		} else {
			await db.insert(notificationPreferences).values({
				organizationId: context.organizationId,
				userId: context.user.id,
				...input,
			});
		}

		return {
			data: input,
			message: "Notification preferences updated",
		};
	});
