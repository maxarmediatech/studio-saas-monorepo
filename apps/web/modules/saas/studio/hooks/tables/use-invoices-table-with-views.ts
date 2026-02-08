"use client";

import type { InvoiceStatus } from "@repo/api/modules/studio/schemas/common";
import { parseAsArrayOf, parseAsString, parseAsStringLiteral } from "nuqs";
import { useDataTableWithViews } from "@/modules/saas/shared/hooks/use-data-table";

const INVOICE_STATUSES = [
	"draft",
	"sent",
	"paid",
	"partial",
	"overdue",
	"cancelled",
] as const;

export interface InvoiceFilters {
	search?: string | null;
	statuses?: InvoiceStatus[] | null;
	createdAt?: string[] | null;
	bookingId?: string | null;
	clientId?: string | null;
}

const invoiceFilterParsers = {
	statuses: parseAsArrayOf(parseAsStringLiteral(INVOICE_STATUSES)),
	createdAt: parseAsArrayOf(parseAsString, ","),
	bookingId: parseAsString,
	clientId: parseAsString,
};

export function useInvoicesTableWithViews() {
	return useDataTableWithViews<InvoiceFilters>(invoiceFilterParsers, {
		entityType: "invoice",
		defaultSortBy: "createdAt",
		defaultSortDirection: "desc",
		defaultLimit: 10,
	});
}
