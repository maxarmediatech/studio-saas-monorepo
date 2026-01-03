import type {
	BillTo,
	PaymentMethod,
} from "@repo/api/modules/studio/schemas/common";
import { expensesApi } from "@saas/studio/lib/api";
import { expenseSearchParamsCache } from "@saas/studio/lib/search-params";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { ExpensesTableClient } from "./ExpensesTableClient";

interface ExpensesTableProps {
	organizationSlug: string;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function ExpensesTable({
	organizationSlug,
	searchParams,
}: ExpensesTableProps) {
	const queryClient = getServerQueryClient();

	// Parse search params using the cache
	const params = await expenseSearchParamsCache.parse(searchParams);

	// Build query input from parsed params
	// Note: API expects single values for billTo, category, paymentMethod
	const input = {
		page: params.page,
		limit: params.limit,
		search: params.search ?? undefined,
		category: params.category?.[0] ?? undefined,
		billTo: params.billTo?.[0] as BillTo | undefined,
		paymentMethod: params.paymentMethod?.[0] as PaymentMethod | undefined,
		sortBy: params.sortBy,
		sortDirection: params.sortDirection,
		includeDeleted: false,
	};

	// Prefetch expenses data on server
	await queryClient.prefetchQuery(expensesApi.listOptions(input));

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<ExpensesTableClient organizationSlug={organizationSlug} />
		</HydrationBoundary>
	);
}
