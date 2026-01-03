import { crewsApi } from "@saas/studio/lib/api";
import { crewSearchParamsCache } from "@saas/studio/lib/search-params";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { CrewsTableClient } from "./CrewsTableClient";

interface CrewsTableProps {
	organizationSlug: string;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function CrewsTable({
	organizationSlug,
	searchParams,
}: CrewsTableProps) {
	const queryClient = getServerQueryClient();

	// Parse search params using the cache
	const params = await crewSearchParamsCache.parse(searchParams);

	// Build query input from parsed params
	// Convert array filters to comma-separated strings (same as client)
	const input = {
		page: params.page,
		limit: params.limit,
		search: params.search ?? undefined,
		status: params.status?.join(",") ?? undefined,
		role: params.role?.join(",") ?? undefined,
		sortBy: params.sortBy,
		sortDirection: params.sortDirection,
		includeDeleted: false,
	};

	// Prefetch crews data on server
	await queryClient.prefetchQuery(crewsApi.listOptions(input));

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<CrewsTableClient organizationSlug={organizationSlug} />
		</HydrationBoundary>
	);
}
