import { PageContent } from "@saas/studio";
import { OpenDeliverableCreateSheet } from "@saas/studio/components/deliverables/OpenDeliverableSheet";
import { StudioRouteGuard } from "@saas/studio/components/StudioRouteGuard";
import { type ReactNode, Suspense } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export default function DeliverablesLayout({ children, params }: Props) {
	return (
		<Suspense fallback={<PageContent title="Deliverables" />}>
			<StudioRouteGuard params={params} routePath="/deliverables">
				{() => (
					<PageContent
						title="Deliverables"
						controls={<OpenDeliverableCreateSheet size="sm" />}
					>
						{children}
					</PageContent>
				)}
			</StudioRouteGuard>
		</Suspense>
	);
}
