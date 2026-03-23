import { PageContent } from "@saas/studio";
import { OpenDeliverableCreateSheet } from "@saas/studio/components/deliverables/OpenDeliverableSheet";
import { buildStudioRoutePath } from "@saas/studio/lib/route-access";
import { requireStudioRouteAccess } from "@saas/studio/lib/server-access";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export default async function DeliverablesLayout({ children, params }: Props) {
	const { organizationSlug } = await params;
	if (
		!(await requireStudioRouteAccess(
			organizationSlug,
			buildStudioRoutePath(organizationSlug, "/deliverables"),
		))
	) {
		notFound();
	}

	return (
		<PageContent
			title="Deliverables"
			controls={<OpenDeliverableCreateSheet size="sm" />}
		>
			{children}
		</PageContent>
	);
}
