"use client";

import { parseAsArrayOf, parseAsString } from "nuqs";
import { useDataTableWithViews } from "@/modules/saas/shared/hooks/use-data-table";

export interface ShootFilters {
	search?: string | null;
	bookingId?: string | null;
	shootType?: string[] | null;
	status?: string[] | null;
	shootDate?: string[] | null;
}

const shootFilterParsers = {
	bookingId: parseAsString,
	shootType: parseAsArrayOf(parseAsString, ","),
	status: parseAsArrayOf(parseAsString, ","),
	shootDate: parseAsArrayOf(parseAsString, ","),
};

export function useShootsTableWithViews() {
	return useDataTableWithViews<ShootFilters>(shootFilterParsers, {
		entityType: "shoot",
		defaultSortBy: "shootDate",
		defaultSortDirection: "desc",
		defaultLimit: 10,
	});
}
