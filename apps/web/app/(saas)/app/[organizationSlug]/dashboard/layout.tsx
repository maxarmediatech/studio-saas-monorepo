import { PageContent } from "@saas/studio";
import { DashboardSkeleton } from "@saas/studio/components/dashboard/dashboard-skeleton";
import { StudioRouteGuard } from "@saas/studio/components/StudioRouteGuard";
import { type ReactNode, Suspense } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export default function DashboardLayout({ children, params }: Props) {
	return (
		<Suspense
			fallback={
				<PageContent title="Dashboard">
					<DashboardSkeleton />
				</PageContent>
			}
		>
			<StudioRouteGuard params={params} routePath="/dashboard">
				{() => <PageContent title="Dashboard">{children}</PageContent>}
			</StudioRouteGuard>
		</Suspense>
	);
}
