import { DeliverablesTableSkeleton, PageContent } from "@saas/studio";
import { OpenDeliverableCreateSheet } from "@saas/studio/components/deliverables/OpenDeliverableSheet";
import { StudioListRouteFallback } from "@saas/studio/components/StudioListRouteFallback";
import { StudioRouteGuard } from "@saas/studio/components/StudioRouteGuard";
import { type ReactNode, Suspense } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export const instant = true;

export default function DeliverablesLayout({ children, params }: Props) {
	return (
		<PageContent
			title="Deliverables"
			controls={<OpenDeliverableCreateSheet size="sm" />}
		>
			<Suspense
				fallback={
					<StudioListRouteFallback label="deliverables">
						<DeliverablesTableSkeleton />
					</StudioListRouteFallback>
				}
			>
				<StudioRouteGuard params={params} routePath="/deliverables">
					{() => children}
				</StudioRouteGuard>
			</Suspense>
		</PageContent>
	);
}
