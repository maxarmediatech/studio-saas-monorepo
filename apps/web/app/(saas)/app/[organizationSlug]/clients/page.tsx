import { getActiveOrganization } from "@saas/auth/lib/server";
import { ClientsPageClient } from "@saas/studio/components/clients/ClientsPageClient";
import { clientsApi } from "@saas/studio/lib/api";
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
		title: `Clients | ${organization?.name ?? "Studio"}`,
	};
}

export default async function ClientsPage({ params, searchParams }: Props) {
	const { organizationSlug } = await params;
	const filters = await searchParams;

	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	const queryClient = getServerQueryClient();

	// Prefetch clients data on server
	const input = {
		page: filters.page ? Number.parseInt(filters.page, 10) : 1,
		limit: 10,
		search: filters.search,
		sortBy: "createdAt" as const,
		sortDirection: "desc" as const,
		includeDeleted: false,
	};

	await queryClient.prefetchQuery(clientsApi.listOptions(input));

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
						<p className="text-muted-foreground">
							Manage your clients and their contact information
						</p>
					</div>
				</div>

				<ClientsPageClient
					organizationSlug={organizationSlug}
					initialFilters={{
						page: input.page,
						search: input.search,
					}}
				/>
			</div>
		</HydrationBoundary>
	);
}
