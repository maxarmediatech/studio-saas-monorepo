"use client";

import { useSession } from "@saas/auth/hooks/use-session";
import { RecentVisitsWidget } from "@saas/studio/components/recent-visits/recent-visits-widget";
import { useParams } from "next/navigation";
import { UserGreeting } from "./user-greeting";
import { QuickLinksWidget } from "./widgets/quick-links";
import { QuickstartGuide } from "./widgets/quickstart-guide";
import { StickiesWidget } from "./widgets/stickies";

export function HomeView() {
	const { organizationSlug } = useParams<{ organizationSlug: string }>();
	const { user } = useSession();
	const timeZone = user?.timezone ?? "UTC";
	const userName = user?.name ?? "";

	return (
		<div className="mx-auto w-full max-w-[800px] pb-8 sm:pb-10">
			<UserGreeting timeZone={timeZone} userName={userName} />
			<div className="flex flex-col gap-5 sm:gap-7">
				<QuickstartGuide organizationSlug={organizationSlug} />
				<QuickLinksWidget />
				<StickiesWidget organizationSlug={organizationSlug} />
				<RecentVisitsWidget organizationSlug={organizationSlug} />
			</div>
		</div>
	);
}
