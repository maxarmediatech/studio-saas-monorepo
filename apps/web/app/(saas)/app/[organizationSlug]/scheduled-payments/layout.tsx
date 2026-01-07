"use client";

import { PageContent } from "@saas/studio";
import { OpenScheduleCreateSheet } from "@saas/studio/components/schedules/OpenScheduleSheet";
import { type ReactNode, use } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export default function ScheduledPaymentsLayout({ params, children }: Props) {
	// Unwrap params promise (required by Next.js, slug available via context)
	use(params);

	return (
		<PageContent
			title="Scheduled Payments"
			controls={<OpenScheduleCreateSheet size="sm" />}
		>
			{children}
		</PageContent>
	);
}
