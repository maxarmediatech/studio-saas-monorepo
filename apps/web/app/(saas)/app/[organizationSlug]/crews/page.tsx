import { getActiveOrganization } from "@saas/auth/lib/server";
import { CrewsPageClient } from "@saas/studio/components/crews/CrewsPageClient";
import { PageHeader } from "@saas/studio";
import { crewsApi } from "@saas/studio/lib/api";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	searchParams: Promise<{
		page?: string;
		search?: string;
		status?: string;
		role?: string;
	}>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	return {
		title: `Team | ${organization?.name ?? "Studio"}`,
	};
}

export default async function CrewsPage({ params, searchParams }: Props) {
	const { organizationSlug } = await params;
	const filters = await searchParams;

	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	const queryClient = getServerQueryClient();

	// Prefetch crews data on server
	const input = {
		page: filters.page ? Number.parseInt(filters.page, 10) : 1,
		limit: 10,
		search: filters.search,
		status: filters.status,
		role: filters.role,
		sortBy: "createdAt" as const,
		sortDirection: "desc" as const,
		includeDeleted: false,
	};

	await queryClient.prefetchQuery(crewsApi.listOptions(input));

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<PageHeader title="Team" />
			<CrewsPageClient
				organizationSlug={organizationSlug}
				initialFilters={{
					page: input.page,
					search: input.search,
					status: input.status,
					role: input.role,
				}}
			/>
		</HydrationBoundary>
	);
}
