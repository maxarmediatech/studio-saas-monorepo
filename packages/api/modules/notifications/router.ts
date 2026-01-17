import { getUnreadNotificationCount } from "./procedures/get-unread-count";
import { listNotifications } from "./procedures/list-notifications";
import { markAllNotificationsRead } from "./procedures/mark-all-read";
import { markNotificationRead } from "./procedures/mark-read";

export const notificationsRouter = {
	list: listNotifications,
	markRead: markNotificationRead,
	markAllRead: markAllNotificationsRead,
	unreadCount: getUnreadNotificationCount,
};
