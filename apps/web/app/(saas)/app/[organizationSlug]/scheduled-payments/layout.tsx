import { Skeleton } from "@repo/ui/components/skeleton";
import { PageContent } from "@saas/studio";
import { StudioRouteGuard } from "@saas/studio/components/StudioRouteGuard";
import { OpenScheduleCreateSheet } from "@saas/studio/components/schedules/OpenScheduleSheet";
import { type ReactNode, Suspense } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export const instant = true;

export default function ScheduledPaymentsLayout({ children, params }: Props) {
	return (
		<PageContent
			title="Scheduled Payments"
			controls={<OpenScheduleCreateSheet size="sm" />}
		>
			<Suspense
				fallback={
					<div className="space-y-4" aria-hidden="true">
						<Skeleton className="h-10 w-full max-w-xl" />
						<Skeleton className="h-64 w-full" />
					</div>
				}
			>
				<StudioRouteGuard
					params={params}
					routePath="/scheduled-payments"
				>
					{() => children}
				</StudioRouteGuard>
			</Suspense>
		</PageContent>
	);
}
