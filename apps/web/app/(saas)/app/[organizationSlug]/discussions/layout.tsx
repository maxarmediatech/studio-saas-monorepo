import { PageContent } from "@saas/studio";
import { StudioRouteGuard } from "@saas/studio/components/StudioRouteGuard";
import { type ReactNode, Suspense } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export default function DiscussionsLayout({ children, params }: Props) {
	return (
		<Suspense fallback={<PageContent title="Discussions" />}>
			<StudioRouteGuard params={params} routePath="/discussions">
				{() => (
					<PageContent title="Discussions">{children}</PageContent>
				)}
			</StudioRouteGuard>
		</Suspense>
	);
}
