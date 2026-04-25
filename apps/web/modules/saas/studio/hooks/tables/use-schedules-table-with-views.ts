"use client";

import { parseAsArrayOf, parseAsString } from "nuqs";
import { useDataTableWithViews } from "@/modules/saas/shared/hooks/use-data-table";

export interface ScheduleFilters {
	search?: string | null;
	status?: string[] | null;
	bookingId?: string | null;
}

const scheduleFilterParsers = {
	status: parseAsArrayOf(parseAsString, ","),
	bookingId: parseAsString,
};

export function useSchedulesTableWithViews() {
	return useDataTableWithViews<ScheduleFilters>(scheduleFilterParsers, {
		entityType: "schedule",
		defaultSortBy: "dueDate",
		defaultSortDirection: "asc",
		defaultLimit: 10,
	});
}
