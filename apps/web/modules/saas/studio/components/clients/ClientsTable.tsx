import { clientsApi } from "@saas/studio/lib/api";
import {
	clientSearchParamsCache,
	getSortFromSearchParams,
} from "@saas/studio/lib/search-params";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { ClientsTableClient } from "./ClientsTableClient";

interface ClientsTableProps {
	organizationSlug: string;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
	lifecycleStage?: "lead" | "client";
}

export async function ClientsTable({
	organizationSlug,
	searchParams,
	lifecycleStage = "client",
}: ClientsTableProps) {
	const queryClient = getServerQueryClient();

	// Parse search params using the cache
	const params = await clientSearchParamsCache.parse(searchParams);

	const { sortBy, sortDirection } = getSortFromSearchParams(params.sort, {
		sortBy: params.sortBy,
		sortDirection: params.sortDirection,
	});

	// Build query input from parsed params
	const input = {
		page: params.page,
		limit: params.limit,
		search: params.search ?? undefined,
		sortBy: sortBy as "name" | "email" | "createdAt" | "updatedAt",
		sortDirection,
		includeDeleted: false,
		lifecycleStage,
	};

	// Prefetch data on server
	await queryClient.prefetchQuery(clientsApi.listOptions(input));

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<ClientsTableClient
				organizationSlug={organizationSlug}
				lifecycleStage={lifecycleStage}
			/>
		</HydrationBoundary>
	);
}
