"use client";

import { parseAsArrayOf, parseAsString } from "nuqs";
import { useDataTableWithViews } from "@/modules/saas/shared/hooks/use-data-table";

export interface DeliverableFilters {
	search?: string | null;
	bookingId?: string | null;
	status?: string[] | null;
}

const deliverableFilterParsers = {
	bookingId: parseAsString,
	status: parseAsArrayOf(parseAsString, ","),
};

export function useDeliverablesTableWithViews() {
	return useDataTableWithViews<DeliverableFilters>(deliverableFilterParsers, {
		entityType: "deliverable",
		defaultSortBy: "dueDate",
		defaultSortDirection: "asc",
		defaultLimit: 10,
	});
}
