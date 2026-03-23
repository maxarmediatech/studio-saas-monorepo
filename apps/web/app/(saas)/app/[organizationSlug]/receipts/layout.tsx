import { buildStudioRoutePath } from "@saas/studio/lib/route-access";
import { requireStudioRouteAccess } from "@saas/studio/lib/server-access";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ReceiptsLayoutClient } from "./receipts-layout-client";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export default async function ReceiptsLayout({ params, children }: Props) {
	const { organizationSlug } = await params;
	if (
		!(await requireStudioRouteAccess(
			organizationSlug,
			buildStudioRoutePath(organizationSlug, "/receipts"),
		))
	) {
		notFound();
	}

	return (
		<ReceiptsLayoutClient organizationSlug={organizationSlug}>
			{children}
		</ReceiptsLayoutClient>
	);
}
