"use client";

import { PageContent } from "@saas/studio";
import { OpenCrewCreateSheet } from "@saas/studio/components/crews/OpenCrewSheet";
import type { ReactNode } from "react";

type Props = {
	children: ReactNode;
};

export default function CrewsLayout({ children }: Props) {
	return (
		<PageContent
			title="Crews"
			controls={<OpenCrewCreateSheet size="sm" />}
		>
			{children}
		</PageContent>
	);
}
