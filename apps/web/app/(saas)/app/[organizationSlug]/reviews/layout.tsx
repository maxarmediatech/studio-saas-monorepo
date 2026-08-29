import { Skeleton } from "@repo/ui/components/skeleton";
import { PageContent } from "@saas/studio";
import { StudioRouteGuard } from "@saas/studio/components/StudioRouteGuard";
import { type PropsWithChildren, Suspense } from "react";

type Props = PropsWithChildren<{
	params: Promise<{ organizationSlug: string }>;
}>;

export const instant = true;

export default function ReviewsLayout({ children, params }: Props) {
	return (
		<PageContent title="Review Queue">
			<Suspense
				fallback={
					<div
						className="grid grid-cols-1 gap-10 lg:grid-cols-[260px_1fr]"
						aria-hidden="true"
					>
						<Skeleton className="h-64 w-full" />
						<div className="space-y-4">
							<Skeleton className="h-9 w-full" />
							<Skeleton className="h-28 w-full" />
							<Skeleton className="h-28 w-full" />
						</div>
					</div>
				}
			>
				<StudioRouteGuard params={params} routePath="/reviews">
					{() => children}
				</StudioRouteGuard>
			</Suspense>
		</PageContent>
	);
}
