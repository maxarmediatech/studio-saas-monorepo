import { PageContent } from "@saas/studio";
import { OpenExpenseCreateSheet } from "@saas/studio/components/expenses/OpenExpenseSheet";
import { buildStudioRoutePath } from "@saas/studio/lib/route-access";
import { requireStudioRouteAccess } from "@saas/studio/lib/server-access";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export default async function ExpensesLayout({ children, params }: Props) {
	const { organizationSlug } = await params;
	if (
		!(await requireStudioRouteAccess(
			organizationSlug,
			buildStudioRoutePath(organizationSlug, "/expenses"),
		))
	) {
		notFound();
	}

	return (
		<PageContent
			title="Expenses"
			controls={<OpenExpenseCreateSheet size="sm" />}
		>
			{children}
		</PageContent>
	);
}
