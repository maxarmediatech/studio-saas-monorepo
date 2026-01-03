import { getActiveOrganization } from "@saas/auth/lib/server";
import { PageContent } from "@saas/studio";
import { ExpensesPageClient } from "@saas/studio/components/expenses/ExpensesPageClient";
import { expensesApi } from "@saas/studio/lib/api";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	searchParams: Promise<{
		page?: string;
		search?: string;
		category?: string;
		billTo?: string;
	}>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	return {
		title: `Expenses | ${organization?.name ?? "Studio"}`,
	};
}

export default async function ExpensesPage({ params, searchParams }: Props) {
	const { organizationSlug } = await params;
	const filters = await searchParams;

	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	const queryClient = getServerQueryClient();

	// Prefetch expenses data on server
	const input = {
		page: filters.page ? Number.parseInt(filters.page, 10) : 1,
		limit: 10,
		search: filters.search,
		category: filters.category,
		billTo: filters.billTo as "studio" | "client" | undefined,
		sortBy: "expenseDate" as const,
		sortDirection: "desc" as const,
		includeDeleted: false,
	};

	await queryClient.prefetchQuery(expensesApi.listOptions(input));

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<PageContent title="Expenses">
				<ExpensesPageClient
					organizationSlug={organizationSlug}
					initialFilters={{
						page: input.page,
						search: input.search,
						category: input.category,
						billTo: input.billTo,
					}}
				/>
			</PageContent>
		</HydrationBoundary>
	);
}
