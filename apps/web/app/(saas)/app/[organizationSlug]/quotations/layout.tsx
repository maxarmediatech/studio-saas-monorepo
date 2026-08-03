import { buildStudioRoutePath } from "@saas/studio/lib/route-access";
import { requireStudioRouteAccess } from "@saas/studio/lib/server-access";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

export default async function QuotationsLayout({
	params,
	children,
}: {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
}) {
	const { organizationSlug } = await params;
	if (
		!(await requireStudioRouteAccess(
			organizationSlug,
			buildStudioRoutePath(organizationSlug, "/quotations"),
		))
	) {
		notFound();
	}
	return children;
}
