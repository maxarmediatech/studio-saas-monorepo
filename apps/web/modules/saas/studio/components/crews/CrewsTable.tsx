import { crewsApi } from "@saas/studio/lib/api";
import {
	crewSearchParamsCache,
	getSortFromSearchParams,
} from "@saas/studio/lib/search-params";
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

	const { sortBy, sortDirection } = getSortFromSearchParams(params.sort, {
		sortBy: params.sortBy,
		sortDirection: params.sortDirection,
	});
	const workerType = params.workerType.filter(
		(value): value is "internal" | "freelancer" =>
			value === "internal" || value === "freelancer",
	);
	const hasAppAccess = params.hasAppAccess.filter(
		(value): value is "true" | "false" =>
			value === "true" || value === "false",
	);

	// Build query input from parsed params
	const input = {
		page: params.page,
		limit: params.limit,
		search: params.search ?? undefined,
		status: params.status ?? undefined,
		workerType: workerType.length > 0 ? workerType : undefined,
		hasAppAccess: hasAppAccess.length > 0 ? hasAppAccess : undefined,
		sortBy,
		sortDirection,
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
