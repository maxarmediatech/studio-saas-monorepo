"use client";

import { ActivityFeedWidget } from "@saas/studio/components/activity-feed";
import { useParams } from "next/navigation";

export function ActivitiesPageClient() {
	const { organizationSlug } = useParams<{ organizationSlug: string }>();

	return (
		<ActivityFeedWidget organizationSlug={organizationSlug} limit={50} />
	);
}
