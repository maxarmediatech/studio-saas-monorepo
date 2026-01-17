"use client";

import { PageContent } from "@saas/studio";
import { OpenTaskCreateSheet } from "@saas/studio/components/tasks/OpenTaskSheet";
import type { ReactNode } from "react";

type Props = {
	children: ReactNode;
};

export default function TasksLayout({ children }: Props) {
	return (
		<PageContent
			title="Tasks"
			controls={<OpenTaskCreateSheet size="sm" />}
		>
			{children}
		</PageContent>
	);
}
