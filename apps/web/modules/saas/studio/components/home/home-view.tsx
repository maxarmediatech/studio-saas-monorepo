"use client";

import { ActivityFeedWidget } from "@saas/studio/components/activity-feed";
import { RecentVisitsWidget } from "@saas/studio/components/recent-visits/recent-visits-widget";
import { UserGreeting } from "./user-greeting";
import { QuickLinksWidget } from "./widgets/quick-links";
import { QuickstartGuide } from "./widgets/quickstart-guide";
import { StickiesWidget } from "./widgets/stickies";

interface HomeViewProps {
	organizationSlug: string;
	userName: string;
}

export function HomeView({ organizationSlug, userName }: HomeViewProps) {
	return (
		<div className="mx-auto max-w-[800px] w-full">
			<UserGreeting userName={userName} />
			<div className="flex flex-col gap-7">
				<QuickstartGuide organizationSlug={organizationSlug} />
				<QuickLinksWidget />
				<StickiesWidget organizationSlug={organizationSlug} />
				<ActivityFeedWidget organizationSlug={organizationSlug} />
				<RecentVisitsWidget organizationSlug={organizationSlug} />
			</div>
		</div>
	);
}
