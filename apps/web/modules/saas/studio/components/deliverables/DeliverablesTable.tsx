import { deliverablesApi } from "@saas/studio/lib/api";
import {
	deliverableSearchParamsCache,
	getSortFromSearchParams,
} from "@saas/studio/lib/search-params";
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

	const { sortBy, sortDirection } = getSortFromSearchParams(params.sort, {
		sortBy: params.sortBy,
		sortDirection: params.sortDirection,
	});

	// Build query input from parsed params
	const input = {
		page: params.page,
		limit: params.limit,
		search: params.search ?? undefined,
		deliverableType: params.deliverableType ?? undefined,
		status: params.status ?? undefined,
		priority: params.priority ?? undefined,
		sortBy,
		sortDirection,
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
