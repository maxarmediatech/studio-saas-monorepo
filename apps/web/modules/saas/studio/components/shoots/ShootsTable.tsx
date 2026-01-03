import { configurationsApi, shootsApi } from "@saas/studio/lib/api";
import { shootSearchParamsCache } from "@saas/studio/lib/search-params";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { ShootsTableClient } from "./ShootsTableClient";

interface ShootsTableProps {
	organizationSlug: string;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function ShootsTable({
	organizationSlug,
	searchParams,
}: ShootsTableProps) {
	const queryClient = getServerQueryClient();

	// Parse search params using the cache
	const params = await shootSearchParamsCache.parse(searchParams);

	// Build query input from parsed params
	// Convert array filters to comma-separated strings (same as client)
	const input = {
		page: params.page,
		limit: params.limit,
		search: params.search ?? undefined,
		shootType: params.shootType?.join(",") ?? undefined,
		status: params.status?.join(",") ?? undefined,
		dateFrom: params.shootDate?.[0] ?? undefined,
		dateTo: params.shootDate?.[1] ?? undefined,
		sortBy: params.sortBy as
			| "name"
			| "shootDate"
			| "shootType"
			| "status"
			| "createdAt",
		sortDirection: params.sortDirection,
		includeDeleted: false,
	};

	// Prefetch data on server in parallel
	await Promise.all([
		queryClient.prefetchQuery(shootsApi.listOptions(input)),
		queryClient.prefetchQuery(configurationsApi.shootStatusOptions()),
	]);

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<ShootsTableClient organizationSlug={organizationSlug} />
		</HydrationBoundary>
	);
}
