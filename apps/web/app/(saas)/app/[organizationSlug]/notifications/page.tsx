import { NotificationsPageClient } from "@saas/studio/components/notifications/notifications-page-client";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export default async function NotificationsPage({ params }: Props) {
	const { organizationSlug } = await params;

	return <NotificationsPageClient organizationSlug={organizationSlug} />;
}
