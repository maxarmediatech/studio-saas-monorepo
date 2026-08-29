import { PageContent } from "@saas/studio";
import { StudioRouteGuard } from "@saas/studio/components/StudioRouteGuard";
import { OpenScheduleCreateSheet } from "@saas/studio/components/schedules/OpenScheduleSheet";
import { type ReactNode, Suspense } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export default function ScheduledPaymentsLayout({ children, params }: Props) {
	return (
		<Suspense fallback={<PageContent title="Scheduled Payments" />}>
			<StudioRouteGuard params={params} routePath="/scheduled-payments">
				{() => (
					<PageContent
						title="Scheduled Payments"
						controls={<OpenScheduleCreateSheet size="sm" />}
					>
						{children}
					</PageContent>
				)}
			</StudioRouteGuard>
		</Suspense>
	);
}
