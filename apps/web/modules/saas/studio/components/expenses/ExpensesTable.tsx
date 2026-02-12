import type {
	BillTo,
	PaymentMethod,
} from "@repo/api/modules/studio/schemas/common";
import { expensesApi } from "@saas/studio/lib/api";
import {
	expenseSearchParamsCache,
	getSortFromSearchParams,
} from "@saas/studio/lib/search-params";
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

	const { sortBy, sortDirection } = getSortFromSearchParams(params.sort, {
		sortBy: params.sortBy,
		sortDirection: params.sortDirection,
	});

	// Build query input from parsed params
	// Note: API expects single values for billTo, category, paymentMethod
	const input = {
		page: params.page,
		limit: params.limit,
		search: params.search ?? undefined,
		category: params.category ?? undefined,
		billTo: params.billTo as BillTo[] | undefined,
		paymentMethod: params.paymentMethod as PaymentMethod[] | undefined,
		bookingId: params.bookingId ?? undefined,
		sortBy,
		sortDirection,
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
