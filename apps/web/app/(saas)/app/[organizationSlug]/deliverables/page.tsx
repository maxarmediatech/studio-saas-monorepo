import { getActiveOrganization } from "@saas/auth/lib/server";
import { DeliverablesPageClient } from "@saas/studio/components/deliverables/DeliverablesPageClient";
import { PageHeader } from "@saas/studio";
import { deliverablesApi } from "@saas/studio/lib/api";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	searchParams: Promise<{
		page?: string;
		search?: string;
	}>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	return {
		title: `Deliverables | ${organization?.name ?? "Studio"}`,
	};
}

export default async function DeliverablesPage({ params, searchParams }: Props) {
	const { organizationSlug } = await params;
	const filters = await searchParams;

	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	const queryClient = getServerQueryClient();

	// Prefetch deliverables data on server
	const input = {
		page: filters.page ? Number.parseInt(filters.page, 10) : 1,
		limit: 10,
		search: filters.search,
		sortBy: "dueDate" as const,
		sortDirection: "asc" as const,
		includeDeleted: false,
	};

	await queryClient.prefetchQuery(deliverablesApi.listOptions(input));

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<PageHeader title="Deliverables" />
			<DeliverablesPageClient
				organizationSlug={organizationSlug}
				initialFilters={{
					page: input.page,
					search: input.search,
				}}
			/>
		</HydrationBoundary>
	);
}
