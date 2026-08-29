import { Skeleton } from "@repo/ui/components/skeleton";
import { PageContent } from "@saas/studio";
import { StudioRouteGuard } from "@saas/studio/components/StudioRouteGuard";
import { type PropsWithChildren, Suspense } from "react";

type Props = PropsWithChildren<{
	params: Promise<{ organizationSlug: string }>;
}>;

export const instant = true;

export default function ActivitiesLayout({ children, params }: Props) {
	return (
		<PageContent title="Activities">
			<Suspense
				fallback={
					<div className="space-y-4" aria-hidden="true">
						<Skeleton className="h-10 w-full max-w-md" />
						<Skeleton className="h-24 w-full" />
						<Skeleton className="h-24 w-full" />
						<Skeleton className="h-24 w-full" />
					</div>
				}
			>
				<StudioRouteGuard params={params} routePath="/activities">
					{() => children}
				</StudioRouteGuard>
			</Suspense>
		</PageContent>
	);
}
