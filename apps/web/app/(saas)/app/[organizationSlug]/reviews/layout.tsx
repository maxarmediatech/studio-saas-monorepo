import { PageContent } from "@saas/studio";
import { StudioRouteGuard } from "@saas/studio/components/StudioRouteGuard";
import { type PropsWithChildren, Suspense } from "react";

type Props = PropsWithChildren<{
	params: Promise<{ organizationSlug: string }>;
}>;

export default function ReviewsLayout({ children, params }: Props) {
	return (
		<Suspense fallback={<PageContent title="Review Queue" />}>
			<StudioRouteGuard params={params} routePath="/reviews">
				{() => children}
			</StudioRouteGuard>
		</Suspense>
	);
}
