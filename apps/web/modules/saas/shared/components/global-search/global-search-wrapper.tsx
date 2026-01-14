"use client";

import type { GlobalSearchResponse } from "@repo/ui/components/global-search";
import { GlobalSearchModal } from "@repo/ui/components/global-search";
import { useRouter } from "@shared/hooks/router";
import { orpcClient } from "@shared/lib/orpc-client";
import { useParams } from "next/navigation";
import { useCallback } from "react";

// Route mapping for entity types
const ENTITY_ROUTES: Record<string, string> = {
	bookings: "bookings",
	clients: "clients",
	crews: "crew",
	shoots: "shoots",
	tasks: "tasks",
	deliverables: "deliverables",
	expenses: "expenses",
	invoices: "invoices",
};

// View all routes (list pages with search query)
const VIEW_ALL_ROUTES: Record<string, string> = {
	bookings: "bookings",
	clients: "clients",
	crews: "crew",
	shoots: "shoots",
	tasks: "tasks",
	deliverables: "deliverables",
	expenses: "expenses",
	invoices: "invoices",
};

export function GlobalSearchWrapper() {
	const router = useRouter();
	const params = useParams<{ organizationSlug: string }>();
	const organizationSlug = params?.organizationSlug;

	// Handle search query
	const handleSearch = useCallback(
		async (query: string): Promise<GlobalSearchResponse> => {
			const result = await orpcClient.globalSearch.search({
				query,
				limit: 5,
			});

			return {
				bookings: result.bookings ?? [],
				clients: result.clients ?? [],
				crews: result.crews ?? [],
				shoots: result.shoots ?? [],
				tasks: result.tasks ?? [],
				deliverables: result.deliverables ?? [],
				expenses: result.expenses ?? [],
				invoices: result.invoices ?? [],
			};
		},
		[],
	);

	// Handle item selection - navigate to detail page
	const handleSelect = useCallback(
		(entityType: string, id: string, _item: Record<string, unknown>) => {
			if (!organizationSlug) return;

			const route = ENTITY_ROUTES[entityType];
			if (!route) return;

			// Navigate to the entity detail page
			router.push(`/app/${organizationSlug}/${route}/${id}`);
		},
		[organizationSlug, router],
	);

	// Handle "View all" - navigate to list page
	const handleViewAll = useCallback(
		(entityType: string, query: string) => {
			if (!organizationSlug) return;

			const route = VIEW_ALL_ROUTES[entityType];
			if (!route) return;

			// Navigate to the list page with search query
			const searchParams = new URLSearchParams();
			if (query) {
				searchParams.set("q", query);
			}

			const url = `/app/${organizationSlug}/${route}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
			router.push(url);
		},
		[organizationSlug, router],
	);

	return (
		<GlobalSearchModal
			onSearch={handleSearch}
			onSelect={handleSelect}
			onViewAll={handleViewAll}
		/>
	);
}
