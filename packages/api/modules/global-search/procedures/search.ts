import { z } from "zod";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	searchBookings,
	searchClients,
	searchCrews,
	searchDeliverables,
	searchExpenses,
	searchInvoices,
	searchShoots,
	searchTasks,
} from "../lib/entity-searchers";
import { type GlobalSearchResponse, SEARCH_ENTITY_TYPES } from "../types";

const searchInputSchema = z.object({
	query: z
		.string()
		.min(2, "Search query must be at least 2 characters")
		.max(100, "Search query must be less than 100 characters")
		.transform((q) => q.trim()),
	entities: z.array(z.enum(SEARCH_ENTITY_TYPES)).optional(),
	limit: z.number().int().min(1).max(20).default(5),
});

export const search = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/global-search",
		tags: ["Global Search"],
		summary: "Search across all workspace entities",
		description:
			"Search bookings, clients, crews, shoots, tasks, deliverables, expenses, and invoices in a single request",
	})
	.input(searchInputSchema)
	.handler(async ({ input, context }): Promise<GlobalSearchResponse> => {
		const { organizationId } = context;
		const { query, entities, limit } = input;

		// Determine which entities to search
		const searchAll = !entities || entities.length === 0;
		const shouldSearch = (type: (typeof SEARCH_ENTITY_TYPES)[number]) =>
			searchAll || entities?.includes(type);

		// Execute all searches in parallel
		const [
			bookings,
			clients,
			crews,
			shoots,
			tasks,
			deliverables,
			expenses,
			invoices,
		] = await Promise.all([
			shouldSearch("booking")
				? searchBookings(organizationId, query, limit)
				: Promise.resolve([]),
			shouldSearch("client")
				? searchClients(organizationId, query, limit)
				: Promise.resolve([]),
			shouldSearch("crew")
				? searchCrews(organizationId, query, limit)
				: Promise.resolve([]),
			shouldSearch("shoot")
				? searchShoots(organizationId, query, limit)
				: Promise.resolve([]),
			shouldSearch("task")
				? searchTasks(organizationId, query, limit)
				: Promise.resolve([]),
			shouldSearch("deliverable")
				? searchDeliverables(organizationId, query, limit)
				: Promise.resolve([]),
			shouldSearch("expense")
				? searchExpenses(organizationId, query, limit)
				: Promise.resolve([]),
			shouldSearch("invoice")
				? searchInvoices(organizationId, query, limit)
				: Promise.resolve([]),
		]);

		return {
			bookings,
			clients,
			crews,
			shoots,
			tasks,
			deliverables,
			expenses,
			invoices,
		};
	});
