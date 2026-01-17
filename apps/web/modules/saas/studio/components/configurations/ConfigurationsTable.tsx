import type { ConfigType } from "@saas/studio/hooks/tables";
import { configurationsApi } from "@saas/studio/lib/api";
import {
	configurationSearchParamsCache,
	getSortFromSearchParams,
} from "@saas/studio/lib/search-params";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { ConfigurationsTableClient } from "./ConfigurationsTableClient";

interface ConfigurationsTableProps {
	configType: ConfigType;
	/** Singular label (e.g., "Booking Type") */
	configTypeLabel: string;
	/** Plural label (e.g., "Booking Types") */
	configTypeLabelPlural: string;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function ConfigurationsTable({
	configType,
	configTypeLabel,
	configTypeLabelPlural,
	searchParams,
}: ConfigurationsTableProps) {
	const queryClient = getServerQueryClient();

	// Parse search params using the cache
	const params = await configurationSearchParamsCache.parse(searchParams);

	const { sortBy, sortDirection } = getSortFromSearchParams(params.sort, {
		sortBy: params.sortBy,
		sortDirection: params.sortDirection,
	});

	// Build query input from parsed params
	const input = {
		type: configType,
		page: params.page,
		limit: params.limit,
		search: params.search ?? undefined,
		sortBy: sortBy as "sortOrder" | "label" | "createdAt",
		sortDirection,
	};

	// Prefetch data on server
	await queryClient.prefetchQuery(configurationsApi.listOptions(input));

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<ConfigurationsTableClient
				configType={configType}
				configTypeLabel={configTypeLabel}
				configTypeLabelPlural={configTypeLabelPlural}
			/>
		</HydrationBoundary>
	);
}
