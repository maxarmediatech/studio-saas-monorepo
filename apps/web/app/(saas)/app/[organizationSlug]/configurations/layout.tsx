import { PageContent } from "@saas/studio";
import { StudioRouteGuard } from "@saas/studio/components/StudioRouteGuard";
import { type PropsWithChildren, Suspense } from "react";

type Props = PropsWithChildren<{
	params: Promise<{ organizationSlug: string }>;
}>;

export default function ConfigurationsLayout({ children, params }: Props) {
	return (
		<Suspense fallback={<PageContent title="Configurations" />}>
			<StudioRouteGuard
				params={params}
				routePath="/configurations/booking-types"
			>
				{() => children}
			</StudioRouteGuard>
		</Suspense>
	);
}
