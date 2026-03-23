import { PageContent } from "@saas/studio";
import { OpenClientCreateSheet } from "@saas/studio/components/clients/OpenClientSheet";
import { buildStudioRoutePath } from "@saas/studio/lib/route-access";
import { requireStudioRouteAccess } from "@saas/studio/lib/server-access";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export default async function ClientsLayout({ children, params }: Props) {
	const { organizationSlug } = await params;
	if (
		!(await requireStudioRouteAccess(
			organizationSlug,
			buildStudioRoutePath(organizationSlug, "/clients"),
		))
	) {
		notFound();
	}

	return (
		<PageContent
			title="Clients"
			controls={<OpenClientCreateSheet size="sm" />}
		>
			{children}
		</PageContent>
	);
}
