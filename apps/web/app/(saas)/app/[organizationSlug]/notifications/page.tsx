import { NotificationsPageClient } from "@saas/studio/components/notifications/notifications-page-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Notifications",
};

export default function NotificationsPage() {
	return <NotificationsPageClient />;
}
