"use client";

import { PageContent } from "@saas/studio";
import { OpenScheduleCreateSheet } from "@saas/studio/components/schedules/OpenScheduleSheet";
import type { ReactNode } from "react";

type Props = {
	children: ReactNode;
};

export default function ScheduledPaymentsLayout({ children }: Props) {
	return (
		<PageContent
			title="Scheduled Payments"
			controls={<OpenScheduleCreateSheet size="sm" />}
		>
			{children}
		</PageContent>
	);
}
