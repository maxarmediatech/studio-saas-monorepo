import { PageContent } from "@saas/studio";
import { NotificationsPageClient } from "@saas/studio/components/notifications/notifications-page-client";
import type { Metadata } from "next";
import { Suspense } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export const metadata: Metadata = {
	title: "Notifications",
};

export default function NotificationsPage({ params }: Props) {
	return (
		<Suspense fallback={<PageContent title="Notifications" />}>
			<NotificationsContent params={params} />
		</Suspense>
	);
}

async function NotificationsContent({ params }: Props) {
	const { organizationSlug } = await params;

	return <NotificationsPageClient organizationSlug={organizationSlug} />;
}
