"use client";

import { PageContent } from "@saas/studio";
import { OpenExpenseCreateSheet } from "@saas/studio/components/expenses/OpenExpenseSheet";
import { type ReactNode, use } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export default function ExpensesLayout({ params, children }: Props) {
	// Unwrap params promise (required by Next.js, slug available via context)
	use(params);

	return (
		<PageContent
			title="Expenses"
			controls={<OpenExpenseCreateSheet size="sm" />}
		>
			{children}
		</PageContent>
	);
}
