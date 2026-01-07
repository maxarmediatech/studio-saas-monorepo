"use client";

import { PageContent } from "@saas/studio";
import { OpenShootCreateSheet } from "@saas/studio/components/shoots/OpenShootSheet";
import { type ReactNode, use } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export default function ShootsLayout({ params, children }: Props) {
	// Unwrap params promise (required by Next.js, slug available via context)
	use(params);

	return (
		<PageContent
			title="Shoots"
			controls={<OpenShootCreateSheet size="sm" />}
		>
			{children}
		</PageContent>
	);
}
