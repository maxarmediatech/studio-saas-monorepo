import { PageContent } from "@saas/studio";
import { ExpensesTableSkeleton } from "@saas/studio/components/expenses";
import { OpenExpenseCreateSheet } from "@saas/studio/components/expenses/OpenExpenseSheet";
import { StudioListRouteFallback } from "@saas/studio/components/StudioListRouteFallback";
import { StudioRouteGuard } from "@saas/studio/components/StudioRouteGuard";
import { type ReactNode, Suspense } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export const instant = true;

export default function ExpensesLayout({ children, params }: Props) {
	return (
		<PageContent
			title="Expenses"
			controls={<OpenExpenseCreateSheet size="sm" />}
		>
			<Suspense
				fallback={
					<StudioListRouteFallback label="expenses">
						<ExpensesTableSkeleton />
					</StudioListRouteFallback>
				}
			>
				<StudioRouteGuard params={params} routePath="/expenses">
					{() => children}
				</StudioRouteGuard>
			</Suspense>
		</PageContent>
	);
}
