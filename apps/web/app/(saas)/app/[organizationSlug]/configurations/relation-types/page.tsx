import { getActiveOrganization } from "@saas/auth/lib/server";
import { ConfigurationsPageClient } from "@saas/studio/components/configurations/ConfigurationsPageClient";
import { configurationsApi } from "@saas/studio/lib/api";
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
		title: `Relation Types | ${organization?.name ?? "Studio"}`,
	};
}

export default async function RelationTypesPage({ params, searchParams }: Props) {
	const { organizationSlug } = await params;
	const filters = await searchParams;

	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	const queryClient = getServerQueryClient();

	const input = {
		type: "relation_type" as const,
		page: filters.page ? Number.parseInt(filters.page, 10) : 1,
		limit: 50,
		search: filters.search,
		sortBy: "sortOrder" as const,
		sortDirection: "asc" as const,
	};

	await queryClient.prefetchQuery(configurationsApi.listOptions(input));

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<ConfigurationsPageClient
				organizationSlug={organizationSlug}
				configType="relation_type"
				configTypeLabel="Relation Type"
				pageTitle="Relation Types"
				pageDescription="Configure client relation types (e.g., Bride, Groom, Family)"
				initialFilters={{
					page: input.page,
					search: input.search,
				}}
			/>
		</HydrationBoundary>
	);
}
