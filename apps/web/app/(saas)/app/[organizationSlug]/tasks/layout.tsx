import { PageContent } from "@saas/studio";
import { OpenTaskCreateSheet } from "@saas/studio/components/tasks/OpenTaskSheet";
import { buildStudioRoutePath } from "@saas/studio/lib/route-access";
import { requireStudioRouteAccess } from "@saas/studio/lib/server-access";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export default async function TasksLayout({ children, params }: Props) {
	const { organizationSlug } = await params;
	if (
		!(await requireStudioRouteAccess(
			organizationSlug,
			buildStudioRoutePath(organizationSlug, "/tasks"),
		))
	) {
		notFound();
	}

	return (
		<PageContent title="Tasks" controls={<OpenTaskCreateSheet size="sm" />}>
			{children}
		</PageContent>
	);
}
