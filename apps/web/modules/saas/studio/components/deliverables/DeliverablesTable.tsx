import { deliverablesApi } from "@saas/studio/lib/api";
import { deliverableSearchParamsCache } from "@saas/studio/lib/search-params";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { DeliverablesTableClient } from "./DeliverablesTableClient";

interface DeliverablesTableProps {
	organizationSlug: string;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function DeliverablesTable({
	organizationSlug,
	searchParams,
}: DeliverablesTableProps) {
	const queryClient = getServerQueryClient();

	// Parse search params using the cache
	const params = await deliverableSearchParamsCache.parse(searchParams);

	// Build query input from parsed params
	// Note: API expects single values for deliverableType, status, priority
	const input = {
		page: params.page,
		limit: params.limit,
		search: params.search ?? undefined,
		deliverableType: params.deliverableType?.[0] ?? undefined,
		status: params.status?.[0] ?? undefined,
		priority: params.priority?.[0] ?? undefined,
		sortBy: params.sortBy,
		sortDirection: params.sortDirection,
		includeDeleted: false,
	};

	// Prefetch deliverables data on server
	await queryClient.prefetchQuery(deliverablesApi.listOptions(input));

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<DeliverablesTableClient organizationSlug={organizationSlug} />
		</HydrationBoundary>
	);
}
