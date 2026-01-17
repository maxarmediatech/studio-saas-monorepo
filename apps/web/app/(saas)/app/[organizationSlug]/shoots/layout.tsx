"use client";

import { PageContent } from "@saas/studio";
import { OpenShootCreateSheet } from "@saas/studio/components/shoots/OpenShootSheet";
import type { ReactNode } from "react";

type Props = {
	children: ReactNode;
};

export default function ShootsLayout({ children }: Props) {
	return (
		<PageContent
			title="Shoots"
			controls={<OpenShootCreateSheet size="sm" />}
		>
			{children}
		</PageContent>
	);
}
