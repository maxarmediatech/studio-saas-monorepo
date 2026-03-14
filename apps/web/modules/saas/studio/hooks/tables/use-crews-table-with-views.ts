"use client";

import { parseAsArrayOf, parseAsString } from "nuqs";
import { useDataTableWithViews } from "@/modules/saas/shared/hooks/use-data-table";

export interface CrewFilters {
	search?: string | null;
	status?: string[] | null;
	specializations?: string[] | null;
	workerType?: string[] | null;
	hasAppAccess?: string[] | null;
}

const crewFilterParsers = {
	status: parseAsArrayOf(parseAsString, ","),
	specializations: parseAsArrayOf(parseAsString, ","),
	workerType: parseAsArrayOf(parseAsString, ","),
	hasAppAccess: parseAsArrayOf(parseAsString, ","),
};

export function useCrewsTableWithViews() {
	return useDataTableWithViews<CrewFilters>(crewFilterParsers, {
		entityType: "crew",
		defaultSortBy: "name",
		defaultSortDirection: "asc",
		defaultLimit: 10,
	});
}
