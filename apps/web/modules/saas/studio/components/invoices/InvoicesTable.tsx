import { invoicesApi } from "@saas/studio/lib/api";
import {
	getSortFromSearchParams,
	invoiceSearchParamsCache,
} from "@saas/studio/lib/search-params";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { InvoicesTableClient } from "./InvoicesTableClient";

interface InvoicesTableProps {
	organizationSlug: string;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function InvoicesTable({
	organizationSlug,
	searchParams,
}: InvoicesTableProps) {
	const queryClient = getServerQueryClient();

	const params = await invoiceSearchParamsCache.parse(searchParams);

	const { sortBy, sortDirection } = getSortFromSearchParams(params.sort, {
		sortBy: params.sortBy,
		sortDirection: params.sortDirection,
	});

	const input = {
		page: params.page,
		limit: params.limit,
		search: params.search ?? undefined,
		status: params.statuses ?? undefined,
		bookingId: params.bookingId ?? undefined,
		dateFrom: params.createdAt?.[0] ?? undefined,
		dateTo: params.createdAt?.[1] ?? undefined,
		sortBy,
		sortDirection,
		includeDeleted: false,
	};

	await queryClient.prefetchQuery(invoicesApi.listOptions(input));

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<InvoicesTableClient organizationSlug={organizationSlug} />
		</HydrationBoundary>
	);
}
