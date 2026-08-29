import { PageContent } from "@saas/studio";
import { StudioRouteGuard } from "@saas/studio/components/StudioRouteGuard";
import { OpenTaskCreateSheet } from "@saas/studio/components/tasks/OpenTaskSheet";
import { type ReactNode, Suspense } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export default function TasksLayout({ children, params }: Props) {
	return (
		<Suspense fallback={<PageContent title="Tasks" />}>
			<StudioRouteGuard params={params} routePath="/tasks">
				{() => (
					<PageContent
						title="Tasks"
						controls={<OpenTaskCreateSheet size="sm" />}
					>
						{children}
					</PageContent>
				)}
			</StudioRouteGuard>
		</Suspense>
	);
}
