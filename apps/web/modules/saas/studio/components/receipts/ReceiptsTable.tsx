import { receiptsApi } from "@saas/studio/lib/api";
import {
	getSortFromSearchParams,
	receiptSearchParamsCache,
} from "@saas/studio/lib/search-params";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { ReceiptsTableClient } from "./ReceiptsTableClient";

interface ReceiptsTableProps {
	organizationSlug: string;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function ReceiptsTable({
	organizationSlug,
	searchParams,
}: ReceiptsTableProps) {
	const queryClient = getServerQueryClient();

	const params = await receiptSearchParamsCache.parse(searchParams);

	const { sortBy, sortDirection } = getSortFromSearchParams(params.sort, {
		sortBy: params.sortBy,
		sortDirection: params.sortDirection,
	});

	const input = {
		page: params.page,
		limit: params.limit,
		search: params.search ?? undefined,
		dateFrom: params.createdAt?.[0] ?? undefined,
		dateTo: params.createdAt?.[1] ?? undefined,
		sortBy,
		sortDirection,
	};

	await queryClient.prefetchQuery(receiptsApi.listOptions(input));

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<ReceiptsTableClient organizationSlug={organizationSlug} />
		</HydrationBoundary>
	);
}
