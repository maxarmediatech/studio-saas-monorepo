import { PageContent } from "@saas/studio";
import { StudioListRouteFallback } from "@saas/studio/components/StudioListRouteFallback";
import { StudioRouteGuard } from "@saas/studio/components/StudioRouteGuard";
import { TasksTableSkeleton } from "@saas/studio/components/tasks";
import { OpenTaskCreateSheet } from "@saas/studio/components/tasks/OpenTaskSheet";
import { type ReactNode, Suspense } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export const instant = true;

export default function TasksLayout({ children, params }: Props) {
	return (
		<PageContent title="Tasks" controls={<OpenTaskCreateSheet size="sm" />}>
			<Suspense
				fallback={
					<StudioListRouteFallback label="tasks">
						<TasksTableSkeleton />
					</StudioListRouteFallback>
				}
			>
				<StudioRouteGuard params={params} routePath="/tasks">
					{() => children}
				</StudioRouteGuard>
			</Suspense>
		</PageContent>
	);
}
