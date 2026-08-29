import { PageContent } from "@saas/studio";
import { DashboardSkeleton } from "@saas/studio/components/dashboard/dashboard-skeleton";
import { StudioRouteGuard } from "@saas/studio/components/StudioRouteGuard";
import { type ReactNode, Suspense } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export const instant = true;

export default function DashboardLayout({ children, params }: Props) {
	return (
		<PageContent title="Dashboard">
			<Suspense fallback={<DashboardSkeleton />}>
				<StudioRouteGuard params={params} routePath="/dashboard">
					{() => children}
				</StudioRouteGuard>
			</Suspense>
		</PageContent>
	);
}
