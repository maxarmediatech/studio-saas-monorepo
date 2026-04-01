import { getNotificationPreferences } from "./procedures/get-preferences";
import { getUnreadNotificationCount } from "./procedures/get-unread-count";
import { listNotifications } from "./procedures/list-notifications";
import { markAllNotificationsRead } from "./procedures/mark-all-read";
import { markNotificationRead } from "./procedures/mark-read";
import { markNotificationUnread } from "./procedures/mark-unread";
import { updateNotificationPreferences } from "./procedures/update-preferences";

export const notificationsRouter = {
	list: listNotifications,
	markRead: markNotificationRead,
	markUnread: markNotificationUnread,
	markAllRead: markAllNotificationsRead,
	unreadCount: getUnreadNotificationCount,
	getPreferences: getNotificationPreferences,
	updatePreferences: updateNotificationPreferences,
};
