import { PageContent } from "@saas/studio";
import { StudioRouteGuard } from "@saas/studio/components/StudioRouteGuard";
import { type PropsWithChildren, Suspense } from "react";

type Props = PropsWithChildren<{
	params: Promise<{ organizationSlug: string }>;
}>;

export default function ActivitiesLayout({ children, params }: Props) {
	return (
		<Suspense fallback={<PageContent title="Activities" />}>
			<StudioRouteGuard params={params} routePath="/activities">
				{() => children}
			</StudioRouteGuard>
		</Suspense>
	);
}
