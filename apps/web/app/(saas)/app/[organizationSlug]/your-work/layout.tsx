import { Skeleton } from "@repo/ui/components/skeleton";
import { PageContent } from "@saas/studio";
import { StudioRouteGuard } from "@saas/studio/components/StudioRouteGuard";
import { type ReactNode, Suspense } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export const instant = true;

export default function YourWorkLayout({ children, params }: Props) {
	return (
		<PageContent title="Your Work">
			<Suspense
				fallback={
					<div className="space-y-4" aria-hidden="true">
						<Skeleton className="h-10 w-full max-w-xl" />
						<Skeleton className="h-64 w-full" />
					</div>
				}
			>
				<StudioRouteGuard params={params} routePath="/your-work">
					{() => children}
				</StudioRouteGuard>
			</Suspense>
		</PageContent>
	);
}
