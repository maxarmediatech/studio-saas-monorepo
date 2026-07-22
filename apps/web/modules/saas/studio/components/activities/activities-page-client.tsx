"use client";

import { PageContent } from "@saas/studio";
import { ActivityFeedWidget } from "@saas/studio/components/activity-feed";

interface ActivitiesPageClientProps {
	organizationSlug: string;
}

export function ActivitiesPageClient({
	organizationSlug,
}: ActivitiesPageClientProps) {
	return (
		<PageContent title="Activities">
			<ActivityFeedWidget
				organizationSlug={organizationSlug}
				limit={50}
			/>
		</PageContent>
	);
}
