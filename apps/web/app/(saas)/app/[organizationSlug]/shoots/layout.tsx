import { PageContent, ShootsTableSkeleton } from "@saas/studio";
import { StudioListRouteFallback } from "@saas/studio/components/StudioListRouteFallback";
import { StudioRouteGuard } from "@saas/studio/components/StudioRouteGuard";
import { OpenShootCreateSheet } from "@saas/studio/components/shoots/OpenShootSheet";
import { type ReactNode, Suspense } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export const instant = true;

export default function ShootsLayout({ children, params }: Props) {
	return (
		<PageContent
			title="Shoots"
			controls={<OpenShootCreateSheet size="sm" />}
		>
			<Suspense
				fallback={
					<StudioListRouteFallback label="shoots">
						<ShootsTableSkeleton />
					</StudioListRouteFallback>
				}
			>
				<StudioRouteGuard params={params} routePath="/shoots">
					{() => children}
				</StudioRouteGuard>
			</Suspense>
		</PageContent>
	);
}
