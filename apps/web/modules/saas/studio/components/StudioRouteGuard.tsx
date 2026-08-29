import "server-only";

import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { buildStudioRoutePath } from "../lib/route-access";
import { requireStudioRouteAccess } from "../lib/server-access";

type StudioRouteGuardProps = {
	params: Promise<{ organizationSlug: string }>;
	routePath: `/${string}`;
	children: (organizationSlug: string) => ReactNode;
};

export async function StudioRouteGuard({
	params,
	routePath,
	children,
}: StudioRouteGuardProps) {
	const { organizationSlug } = await params;
	if (
		!(await requireStudioRouteAccess(
			organizationSlug,
			buildStudioRoutePath(organizationSlug, routePath),
		))
	) {
		notFound();
	}

	return children(organizationSlug);
}
