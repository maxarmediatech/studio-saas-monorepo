import { Skeleton } from "@repo/ui/components/skeleton";
import { PageContent } from "@saas/studio";
import { StudioRouteGuard } from "@saas/studio/components/StudioRouteGuard";
import { type ReactNode, Suspense } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export const instant = true;

export default function DiscussionsLayout({ children, params }: Props) {
	return (
		<PageContent title="Discussions">
			<Suspense
				fallback={
					<div
						className="mx-auto w-full max-w-[800px] space-y-4"
						aria-hidden="true"
					>
						<Skeleton className="h-10 w-48" />
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-14 w-full rounded-xl" />
						<Skeleton className="h-16 w-full" />
						<Skeleton className="h-16 w-full" />
					</div>
				}
			>
				<StudioRouteGuard params={params} routePath="/discussions">
					{() => children}
				</StudioRouteGuard>
			</Suspense>
		</PageContent>
	);
}
