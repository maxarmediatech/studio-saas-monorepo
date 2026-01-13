"use client";

import { RecentVisitsWidget } from "@saas/studio/components/recent-visits/recent-visits-widget";
import { UserGreeting } from "./user-greeting";
import { QuickstartGuide } from "./widgets/quickstart-guide";

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
				<RecentVisitsWidget organizationSlug={organizationSlug} />
			</div>
		</div>
	);
}
