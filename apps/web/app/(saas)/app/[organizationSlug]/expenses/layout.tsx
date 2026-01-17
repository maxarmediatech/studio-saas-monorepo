"use client";

import { PageContent } from "@saas/studio";
import { OpenExpenseCreateSheet } from "@saas/studio/components/expenses/OpenExpenseSheet";
import type { ReactNode } from "react";

type Props = {
	children: ReactNode;
};

export default function ExpensesLayout({ children }: Props) {
	return (
		<PageContent
			title="Expenses"
			controls={<OpenExpenseCreateSheet size="sm" />}
		>
			{children}
		</PageContent>
	);
}
