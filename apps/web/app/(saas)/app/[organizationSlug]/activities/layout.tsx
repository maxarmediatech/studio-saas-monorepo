import { buildStudioRoutePath } from "@saas/studio/lib/route-access";
import { requireStudioRouteAccess } from "@saas/studio/lib/server-access";
import { notFound } from "next/navigation";
import type { PropsWithChildren } from "react";

type Props = PropsWithChildren<{
	params: Promise<{ organizationSlug: string }>;
}>;

export default async function ActivitiesLayout({ children, params }: Props) {
	const { organizationSlug } = await params;
	if (
		!(await requireStudioRouteAccess(
			organizationSlug,
			buildStudioRoutePath(organizationSlug, "/activities"),
		))
	) {
		notFound();
	}

	return children;
}
