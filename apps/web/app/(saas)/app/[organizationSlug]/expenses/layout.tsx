import { PageContent } from "@saas/studio";
import { OpenExpenseCreateSheet } from "@saas/studio/components/expenses/OpenExpenseSheet";
import { StudioRouteGuard } from "@saas/studio/components/StudioRouteGuard";
import { type ReactNode, Suspense } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export default function ExpensesLayout({ children, params }: Props) {
	return (
		<Suspense fallback={<PageContent title="Expenses" />}>
			<StudioRouteGuard params={params} routePath="/expenses">
				{() => (
					<PageContent
						title="Expenses"
						controls={<OpenExpenseCreateSheet size="sm" />}
					>
						{children}
					</PageContent>
				)}
			</StudioRouteGuard>
		</Suspense>
	);
}
