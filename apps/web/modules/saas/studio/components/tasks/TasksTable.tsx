import { tasksApi } from "@saas/studio/lib/api";
import { taskSearchParamsCache } from "@saas/studio/lib/search-params";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { TasksTableClient } from "./TasksTableClient";

interface TasksTableProps {
	organizationSlug: string;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function TasksTable({
	organizationSlug,
	searchParams,
}: TasksTableProps) {
	const queryClient = getServerQueryClient();

	// Parse search params using the cache
	const params = await taskSearchParamsCache.parse(searchParams);

	// Build query input from parsed params
	// Convert array filters to comma-separated strings (same as client)
	const input = {
		page: params.page,
		limit: params.limit,
		search: params.search ?? undefined,
		status: params.status?.join(",") ?? undefined,
		priority: params.priority?.join(",") ?? undefined,
		sortBy: params.sortBy,
		sortDirection: params.sortDirection,
		includeDeleted: false,
	};

	// Prefetch tasks data on server
	await queryClient.prefetchQuery(tasksApi.listOptions(input));

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<TasksTableClient organizationSlug={organizationSlug} />
		</HydrationBoundary>
	);
}
