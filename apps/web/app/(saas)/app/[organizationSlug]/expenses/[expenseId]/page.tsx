import { expensesApi } from "@saas/studio/lib/api";
import { getOrganizationPageMetadata } from "@saas/studio/lib/organization-page-metadata";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";
import {
	ExpenseDetailPageClient,
	ExpenseDetailSkeleton,
} from "./ExpenseDetailPageClient";

type Props = {
	params: Promise<{ organizationSlug: string; expenseId: string }>;
};

export function generateMetadata({ params }: Props) {
	return getOrganizationPageMetadata(params, "Expense Details");
}

export default function ExpenseDetailPage({ params }: Props) {
	return (
		<Suspense fallback={<ExpenseDetailSkeleton />}>
			<ExpenseDetailContent params={params} />
		</Suspense>
	);
}

async function ExpenseDetailContent({ params }: Props) {
	const { organizationSlug, expenseId } = await params;
	const queryClient = getServerQueryClient();
	await queryClient.prefetchQuery(expensesApi.getOptions(expenseId));

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<ExpenseDetailPageClient
				organizationSlug={organizationSlug}
				expenseId={expenseId}
			/>
		</HydrationBoundary>
	);
}
