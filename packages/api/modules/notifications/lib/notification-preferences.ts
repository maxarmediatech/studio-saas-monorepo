import { z } from "zod";

export const notificationPreferencesSchema = z.object({
	assignedToMe: z.boolean(),
	itemsIAssigned: z.boolean(),
	bookingsIOwn: z.boolean(),
	itemsIFollow: z.boolean(),
	mentions: z.boolean(),
	dueOverdueReminders: z.boolean(),
});

export const defaultNotificationPreferences = {
	assignedToMe: true,
	itemsIAssigned: true,
	bookingsIOwn: true,
	itemsIFollow: true,
	mentions: true,
	dueOverdueReminders: true,
} satisfies z.infer<typeof notificationPreferencesSchema>;

export type NotificationPreferences = z.infer<
	typeof notificationPreferencesSchema
>;

export type NotificationRecipientReason =
	| "assignee"
	| "assigner"
	| "booking_owner"
	| "subscriber"
	| "mention"
	| "reminder";

export function getEffectiveNotificationPreferences(
	preferences?: Partial<NotificationPreferences> | null,
): NotificationPreferences {
	return {
		...defaultNotificationPreferences,
		...preferences,
	};
}

export function shouldNotifyForReasons(
	preferences: NotificationPreferences,
	reasons: Iterable<NotificationRecipientReason>,
) {
	for (const reason of reasons) {
		if (
			(reason === "assignee" && preferences.assignedToMe) ||
			(reason === "assigner" && preferences.itemsIAssigned) ||
			(reason === "booking_owner" && preferences.bookingsIOwn) ||
			(reason === "subscriber" && preferences.itemsIFollow) ||
			(reason === "mention" && preferences.mentions) ||
			(reason === "reminder" && preferences.dueOverdueReminders)
		) {
			return true;
		}
	}

	return false;
}
