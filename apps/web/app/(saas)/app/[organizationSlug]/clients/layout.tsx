"use client";

import { PageContent } from "@saas/studio";
import { OpenClientCreateSheet } from "@saas/studio/components/clients/OpenClientSheet";
import type { ReactNode } from "react";

type Props = {
	children: ReactNode;
};

export default function ClientsLayout({ children }: Props) {
	return (
		<PageContent
			title="Clients"
			controls={<OpenClientCreateSheet size="sm" />}
		>
			{children}
		</PageContent>
	);
}
