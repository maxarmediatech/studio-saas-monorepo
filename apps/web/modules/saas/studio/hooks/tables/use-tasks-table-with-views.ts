"use client";

import { parseAsArrayOf, parseAsString } from "nuqs";
import { useDataTableWithViews } from "@/modules/saas/shared/hooks/use-data-table";

export interface TaskFilters {
	search?: string | null;
	bookingId?: string | null;
	status?: string[] | null;
	priority?: string[] | null;
}

const taskFilterParsers = {
	bookingId: parseAsString,
	status: parseAsArrayOf(parseAsString, ","),
	priority: parseAsArrayOf(parseAsString, ","),
};

export function useTasksTableWithViews() {
	return useDataTableWithViews<TaskFilters>(taskFilterParsers, {
		entityType: "task",
		defaultSortBy: "dueDate",
		defaultSortDirection: "asc",
		defaultLimit: 10,
	});
}
