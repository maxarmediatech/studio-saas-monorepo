import { PageContent } from "@saas/studio";
import { StudioRouteGuard } from "@saas/studio/components/StudioRouteGuard";
import { OpenShootCreateSheet } from "@saas/studio/components/shoots/OpenShootSheet";
import { type ReactNode, Suspense } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export default function ShootsLayout({ children, params }: Props) {
	return (
		<Suspense fallback={<PageContent title="Shoots" />}>
			<StudioRouteGuard params={params} routePath="/shoots">
				{() => (
					<PageContent
						title="Shoots"
						controls={<OpenShootCreateSheet size="sm" />}
					>
						{children}
					</PageContent>
				)}
			</StudioRouteGuard>
		</Suspense>
	);
}
