import { clientsApi } from "@saas/studio/lib/api";
import { clientSearchParamsCache } from "@saas/studio/lib/search-params";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { ClientsTableClient } from "./ClientsTableClient";

interface ClientsTableProps {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function ClientsTable({ searchParams }: ClientsTableProps) {
	const queryClient = getServerQueryClient();

	// Parse search params using the cache
	const params = await clientSearchParamsCache.parse(searchParams);

	// Build query input from parsed params
	const input = {
		page: params.page,
		limit: params.limit,
		search: params.search ?? undefined,
		sortBy: params.sortBy as "name" | "email" | "createdAt" | "updatedAt",
		sortDirection: params.sortDirection,
		includeDeleted: false,
	};

	// Prefetch data on server
	await queryClient.prefetchQuery(clientsApi.listOptions(input));

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<ClientsTableClient />
		</HydrationBoundary>
	);
}
