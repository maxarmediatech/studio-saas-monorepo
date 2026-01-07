import type { PaymentScheduleStatus } from "@repo/api/modules/studio/schemas/common";
import { studioPaymentsApi } from "@saas/studio/lib/api";
import {
	getSortFromSearchParams,
	scheduleSearchParamsCache,
} from "@saas/studio/lib/search-params";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { SchedulesTableClient } from "./SchedulesTableClient";

interface SchedulesTableProps {
	organizationSlug: string;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function SchedulesTable({
	organizationSlug,
	searchParams,
}: SchedulesTableProps) {
	const queryClient = getServerQueryClient();

	// Parse search params using the cache
	const params = await scheduleSearchParamsCache.parse(searchParams);

	const { sortBy, sortDirection } = getSortFromSearchParams(params.sort, {
		sortBy: params.sortBy,
		sortDirection: params.sortDirection,
	});

	// Build query input from parsed params
	const input = {
		page: params.page,
		limit: params.limit,
		search: params.search ?? undefined,
		status: params.status as PaymentScheduleStatus[] | undefined,
		sortBy,
		sortDirection,
		includeDeleted: false,
	};

	// Prefetch schedules data on server
	await queryClient.prefetchQuery(
		studioPaymentsApi.listSchedulesOptions(input),
	);

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<SchedulesTableClient organizationSlug={organizationSlug} />
		</HydrationBoundary>
	);
}
