import { PageContent } from "@saas/studio";
import { OpenPaymentCreateSheet } from "@saas/studio/components/payments/OpenPaymentSheet";
import { buildStudioRoutePath } from "@saas/studio/lib/route-access";
import { requireStudioRouteAccess } from "@saas/studio/lib/server-access";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export default async function PaymentsLayout({ children, params }: Props) {
	const { organizationSlug } = await params;
	if (
		!(await requireStudioRouteAccess(
			organizationSlug,
			buildStudioRoutePath(organizationSlug, "/payments"),
		))
	) {
		notFound();
	}

	return (
		<PageContent
			title="Payments"
			controls={<OpenPaymentCreateSheet size="sm" />}
		>
			{children}
		</PageContent>
	);
}
