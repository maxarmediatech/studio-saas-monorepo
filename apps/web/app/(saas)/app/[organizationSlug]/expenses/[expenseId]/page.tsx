import { getActiveOrganization } from "@saas/auth/lib/server";
import { expensesApi } from "@saas/studio/lib/api";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { ExpenseDetailPageClient } from "./ExpenseDetailPageClient";

type Props = {
	params: Promise<{ organizationSlug: string; expenseId: string }>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	return {
		title: `Expense Details | ${organization?.name ?? "Studio"}`,
	};
}

export default async function ExpenseDetailPage({ params }: Props) {
	const { organizationSlug, expenseId } = await params;

	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

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
