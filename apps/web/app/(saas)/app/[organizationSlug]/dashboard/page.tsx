import { DashboardView } from "@saas/studio/components/dashboard";
import { DashboardSkeleton } from "@saas/studio/components/dashboard/dashboard-skeleton";
import { getOrganizationPageMetadata } from "@saas/studio/lib/organization-page-metadata";
import { Suspense } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export function generateMetadata({ params }: Props) {
	return getOrganizationPageMetadata(params, "Dashboard");
}

export default function DashboardPage() {
	return (
		<Suspense fallback={<DashboardSkeleton />}>
			<DashboardView />
		</Suspense>
	);
}
