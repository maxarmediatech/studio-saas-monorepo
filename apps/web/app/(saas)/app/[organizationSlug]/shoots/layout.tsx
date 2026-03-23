import { PageContent } from "@saas/studio";
import { OpenShootCreateSheet } from "@saas/studio/components/shoots/OpenShootSheet";
import { buildStudioRoutePath } from "@saas/studio/lib/route-access";
import { requireStudioRouteAccess } from "@saas/studio/lib/server-access";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export default async function ShootsLayout({ children, params }: Props) {
	const { organizationSlug } = await params;
	if (
		!(await requireStudioRouteAccess(
			organizationSlug,
			buildStudioRoutePath(organizationSlug, "/shoots"),
		))
	) {
		notFound();
	}

	return (
		<PageContent
			title="Shoots"
			controls={<OpenShootCreateSheet size="sm" />}
		>
			{children}
		</PageContent>
	);
}
