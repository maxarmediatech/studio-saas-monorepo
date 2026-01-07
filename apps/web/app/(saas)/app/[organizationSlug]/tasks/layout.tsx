"use client";

import { PageContent } from "@saas/studio";
import { OpenTaskCreateSheet } from "@saas/studio/components/tasks/OpenTaskSheet";
import { type ReactNode, use } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export default function TasksLayout({ params, children }: Props) {
	// Unwrap params promise (required by Next.js, slug available via context)
	use(params);

	return (
		<PageContent title="Tasks" controls={<OpenTaskCreateSheet size="sm" />}>
			{children}
		</PageContent>
	);
}
