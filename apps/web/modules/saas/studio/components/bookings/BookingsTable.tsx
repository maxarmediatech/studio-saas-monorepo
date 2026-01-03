import { bookingsApi } from "@saas/studio/lib/api";
import {
	bookingSearchParamsCache,
	getSortFromSearchParams,
} from "@saas/studio/lib/search-params";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { BookingsTableClient } from "./BookingsTableClient";

interface BookingsTableProps {
	organizationSlug: string;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function BookingsTable({
	organizationSlug,
	searchParams,
}: BookingsTableProps) {
	const queryClient = getServerQueryClient();

	// Parse search params using the cache
	const params = await bookingSearchParamsCache.parse(searchParams);

	const { sortBy, sortDirection } = getSortFromSearchParams(params.sort, {
		sortBy: params.sortBy,
		sortDirection: params.sortDirection,
	});

	// Build query input from parsed params
	// Convert array filters to comma-separated strings (same as client)
	const input = {
		page: params.page,
		limit: params.limit,
		search: params.search ?? undefined,
		statuses: params.statuses ?? undefined,
		bookingType: params.bookingType?.join(",") ?? undefined,
		packageType: params.packageType?.join(",") ?? undefined,
		createdAt: params.createdAt?.join(",") ?? undefined,
		sortBy,
		sortDirection,
		includeDeleted: false,
	};

	// Prefetch bookings data on server
	await queryClient.prefetchQuery(bookingsApi.listOptions(input));

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<BookingsTableClient organizationSlug={organizationSlug} />
		</HydrationBoundary>
	);
}
