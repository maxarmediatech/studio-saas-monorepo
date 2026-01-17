"use client";

import { useDataTableWithViews } from "@/modules/saas/shared/hooks/use-data-table";

export interface ClientFilters {
	search?: string | null;
}

const clientFilterParsers = {};

export function useClientsTableWithViews() {
	return useDataTableWithViews<ClientFilters>(clientFilterParsers, {
		entityType: "client",
		defaultSortBy: "name",
		defaultSortDirection: "asc",
		defaultLimit: 10,
	});
}
