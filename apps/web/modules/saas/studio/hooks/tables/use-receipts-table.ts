"use client";

import { parseAsArrayOf, parseAsString } from "nuqs";
import { useDataTable } from "@/modules/saas/shared/hooks/use-data-table";

export interface ReceiptFilters {
	search?: string | null;
	createdAt?: string[] | null;
	bookingId?: string | null;
	invoiceId?: string | null;
}

const receiptFilterParsers = {
	createdAt: parseAsArrayOf(parseAsString, ","),
	bookingId: parseAsString,
	invoiceId: parseAsString,
};

export function useReceiptsTable() {
	return useDataTable<ReceiptFilters>(receiptFilterParsers, {
		defaultSortBy: "receiptDate",
		defaultSortDirection: "desc",
		defaultLimit: 10,
	});
}
