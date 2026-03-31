import { and, db, eq, notificationPreferences } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { getNotificationPreferencesOutputSchema } from "../../studio/schemas/notification";
import { getEffectiveNotificationPreferences } from "../lib/notification-preferences";

export const getNotificationPreferences = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/notifications/preferences",
		tags: ["Notifications"],
		summary: "Get notification preferences",
		description: "Get in-app notification preferences for the current user",
	})
	.output(getNotificationPreferencesOutputSchema)
	.handler(async ({ context }) => {
		const existing = await db.query.notificationPreferences.findFirst({
			where: and(
				eq(
					notificationPreferences.organizationId,
					context.organizationId,
				),
				eq(notificationPreferences.userId, context.user.id),
			),
		});

		return {
			data: getEffectiveNotificationPreferences(existing),
		};
	});
