import { PageContent } from "@saas/studio";
import { StudioRouteGuard } from "@saas/studio/components/StudioRouteGuard";
import { type ReactNode, Suspense } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export default function YourWorkLayout({ children, params }: Props) {
	return (
		<Suspense fallback={<PageContent title="Your Work" />}>
			<StudioRouteGuard params={params} routePath="/your-work">
				{() => <PageContent title="Your Work">{children}</PageContent>}
			</StudioRouteGuard>
		</Suspense>
	);
}
