"use client";

import { PageContent } from "@saas/studio";
import { OpenDeliverableCreateSheet } from "@saas/studio/components/deliverables/OpenDeliverableSheet";
import { type ReactNode, use } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export default function DeliverablesLayout({ params, children }: Props) {
	// Unwrap params promise (required by Next.js, slug available via context)
	use(params);

	return (
		<PageContent
			title="Deliverables"
			controls={<OpenDeliverableCreateSheet size="sm" />}
		>
			{children}
		</PageContent>
	);
}
