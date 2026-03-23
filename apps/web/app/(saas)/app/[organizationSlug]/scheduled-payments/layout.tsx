import { PageContent } from "@saas/studio";
import { OpenScheduleCreateSheet } from "@saas/studio/components/schedules/OpenScheduleSheet";
import { buildStudioRoutePath } from "@saas/studio/lib/route-access";
import { requireStudioRouteAccess } from "@saas/studio/lib/server-access";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export default async function ScheduledPaymentsLayout({
	children,
	params,
}: Props) {
	const { organizationSlug } = await params;
	if (
		!(await requireStudioRouteAccess(
			organizationSlug,
			buildStudioRoutePath(organizationSlug, "/scheduled-payments"),
		))
	) {
		notFound();
	}

	return (
		<PageContent
			title="Scheduled Payments"
			controls={<OpenScheduleCreateSheet size="sm" />}
		>
			{children}
		</PageContent>
	);
}
