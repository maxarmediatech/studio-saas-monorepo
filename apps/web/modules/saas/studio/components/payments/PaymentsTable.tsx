import type { PaymentMethod } from "@repo/api/modules/studio/schemas/common";
import { studioPaymentsApi } from "@saas/studio/lib/api";
import {
	getSortFromSearchParams,
	paymentSearchParamsCache,
} from "@saas/studio/lib/search-params";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { PaymentsTableClient } from "./PaymentsTableClient";

interface PaymentsTableProps {
	organizationSlug: string;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function PaymentsTable({
	organizationSlug,
	searchParams,
}: PaymentsTableProps) {
	const queryClient = getServerQueryClient();

	// Parse search params using the cache
	const params = await paymentSearchParamsCache.parse(searchParams);

	const { sortBy, sortDirection } = getSortFromSearchParams(params.sort, {
		sortBy: params.sortBy,
		sortDirection: params.sortDirection,
	});

	// Build query input from parsed params
	// Note: API expects single paymentMethod, so take the first value if provided
	const input = {
		page: params.page,
		limit: params.limit,
		search: params.search ?? undefined,
		bookingId: params.bookingId ?? undefined,
		paymentMethod: params.paymentMethod as PaymentMethod[] | undefined,
		sortBy,
		sortDirection,
		includeDeleted: false,
	};

	// Prefetch payments data on server
	await queryClient.prefetchQuery(
		studioPaymentsApi.listReceivedOptions(input),
	);

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<PaymentsTableClient organizationSlug={organizationSlug} />
		</HydrationBoundary>
	);
}
