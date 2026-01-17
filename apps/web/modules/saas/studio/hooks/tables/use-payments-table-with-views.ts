"use client";

import { parseAsArrayOf, parseAsString } from "nuqs";
import { useDataTableWithViews } from "@/modules/saas/shared/hooks/use-data-table";

export interface PaymentFilters {
	search?: string | null;
	paymentMethod?: string[] | null;
}

const paymentFilterParsers = {
	paymentMethod: parseAsArrayOf(parseAsString, ","),
};

export function usePaymentsTableWithViews() {
	return useDataTableWithViews<PaymentFilters>(paymentFilterParsers, {
		entityType: "payment",
		defaultSortBy: "receivedDate",
		defaultSortDirection: "desc",
		defaultLimit: 10,
	});
}
