import { buildStudioRoutePath } from "@saas/studio/lib/route-access";
import { requireStudioRouteAccess } from "@saas/studio/lib/server-access";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { InvoicesLayoutClient } from "./invoices-layout-client";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export default async function InvoicesLayout({ params, children }: Props) {
	const { organizationSlug } = await params;
	if (
		!(await requireStudioRouteAccess(
			organizationSlug,
			buildStudioRoutePath(organizationSlug, "/invoices"),
		))
	) {
		notFound();
	}

	return (
		<InvoicesLayoutClient organizationSlug={organizationSlug}>
			{children}
		</InvoicesLayoutClient>
	);
}
