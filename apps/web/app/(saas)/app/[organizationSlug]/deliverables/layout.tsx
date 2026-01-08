"use client";

import { PageContent } from "@saas/studio";
import { OpenDeliverableCreateSheet } from "@saas/studio/components/deliverables/OpenDeliverableSheet";
import type { ReactNode } from "react";

type Props = {
	children: ReactNode;
};

export default function DeliverablesLayout({ children }: Props) {
	return (
		<PageContent
			title="Deliverables"
			controls={<OpenDeliverableCreateSheet size="sm" />}
		>
			{children}
		</PageContent>
	);
}
