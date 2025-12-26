import { getActiveOrganization } from "@saas/auth/lib/server";
import { PageHeader } from "@saas/studio";
import { ShootsPageClient } from "@saas/studio/components/shoots/ShootsPageClient";
import { shootsApi } from "@saas/studio/lib/api";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	searchParams: Promise<{
		page?: string;
		search?: string;
		bookingId?: string;
	}>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	return {
		title: `Shoots | ${organization?.name ?? "Studio"}`,
	};
}

export default async function ShootsPage({ params, searchParams }: Props) {
	const { organizationSlug } = await params;
	const filters = await searchParams;

	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	const queryClient = getServerQueryClient();

	// Prefetch shoots data on server
	const input = {
		page: filters.page ? Number.parseInt(filters.page, 10) : 1,
		limit: 10,
		search: filters.search,
		bookingId: filters.bookingId,
		sortBy: "shootDate" as const,
		sortDirection: "desc" as const,
		includeDeleted: false,
	};

	await queryClient.prefetchQuery(shootsApi.listOptions(input));

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<PageHeader title="Shoots" />
			<ShootsPageClient
				organizationSlug={organizationSlug}
				initialFilters={{
					page: input.page,
					search: input.search,
					bookingId: input.bookingId,
				}}
			/>
		</HydrationBoundary>
	);
}
