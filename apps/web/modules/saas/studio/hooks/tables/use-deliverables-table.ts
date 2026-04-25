"use client";

import { parseAsArrayOf, parseAsString } from "nuqs";
import { useDataTable } from "@/modules/saas/shared/hooks/use-data-table";

const DELIVERABLE_STATUSES = [
	"pending",
	"in_progress",
	"completed",
	"delivered",
] as const;

export interface DeliverableFilters {
	search?: string | null;
	bookingId?: string | null;
	status?: string[] | null;
}

const deliverableFilterParsers = {
	bookingId: parseAsString,
	status: parseAsArrayOf(parseAsString, ","),
};

export function useDeliverablesTable() {
	return useDataTable<DeliverableFilters>(deliverableFilterParsers, {
		columnVisibilityKey: "deliverable",
		defaultSortBy: "dueDate",
		defaultSortDirection: "asc",
		defaultLimit: 10,
	});
}

export { DELIVERABLE_STATUSES };
