import { z } from "zod";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { hasPermission } from "../../studio/lib/permissions";
import { parseExactMoneyQuery } from "../../studio/lib/search-input";
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
		const canSearchAny = async (
			permissions: Array<{
				resource:
					| "booking"
					| "client"
					| "crew"
					| "shoot"
					| "task"
					| "deliverable"
					| "expense"
					| "payment";
				action: "read" | "list" | "reference";
			}>,
		) => {
			const results = await Promise.all(
				permissions.map(({ resource, action }) =>
					hasPermission(context, resource, action),
				),
			);
			return results.some(Boolean);
		};
		const isMoneyQuery = parseExactMoneyQuery(query) !== null;
		const needsClientListPermission =
			shouldSearch("client") ||
			shouldSearch("shoot") ||
			shouldSearch("deliverable");
		const needsPaymentListPermission =
			shouldSearch("invoice") ||
			(shouldSearch("booking") && isMoneyQuery);
		const [
			canSearchBookings,
			canListClients,
			canSearchCrews,
			canSearchShoots,
			canSearchTasks,
			canSearchDeliverables,
			canSearchExpenses,
			canListPayments,
			canReferencePayments,
		] = await Promise.all([
			shouldSearch("booking")
				? canSearchAny([{ resource: "booking", action: "list" }])
				: Promise.resolve(false),
			needsClientListPermission
				? canSearchAny([{ resource: "client", action: "list" }])
				: Promise.resolve(false),
			shouldSearch("crew")
				? canSearchAny([{ resource: "crew", action: "list" }])
				: Promise.resolve(false),
			shouldSearch("shoot")
				? canSearchAny([{ resource: "shoot", action: "list" }])
				: Promise.resolve(false),
			shouldSearch("task")
				? canSearchAny([{ resource: "task", action: "list" }])
				: Promise.resolve(false),
			shouldSearch("deliverable")
				? canSearchAny([{ resource: "deliverable", action: "list" }])
				: Promise.resolve(false),
			shouldSearch("expense")
				? canSearchAny([
						{ resource: "expense", action: "list" },
						{ resource: "expense", action: "reference" },
					])
				: Promise.resolve(false),
			needsPaymentListPermission
				? canSearchAny([{ resource: "payment", action: "list" }])
				: Promise.resolve(false),
			shouldSearch("invoice")
				? canSearchAny([{ resource: "payment", action: "reference" }])
				: Promise.resolve(false),
		]);
		const canSearchClients = shouldSearch("client") && canListClients;
		const canReadRelatedClientNames = canListClients;
		const canReadPaymentAmounts = isMoneyQuery && canListPayments;
		const canSearchInvoices =
			shouldSearch("invoice") &&
			(canListPayments || canReferencePayments);

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
			canSearchBookings
				? searchBookings(organizationId, query, limit, {
						includePaymentAmounts: canReadPaymentAmounts,
					})
				: Promise.resolve([]),
			canSearchClients
				? searchClients(organizationId, query, limit)
				: Promise.resolve([]),
			canSearchCrews
				? searchCrews(organizationId, query, limit)
				: Promise.resolve([]),
			canSearchShoots
				? searchShoots(organizationId, query, limit, {
						includeClientNames: canReadRelatedClientNames,
					})
				: Promise.resolve([]),
			canSearchTasks
				? searchTasks(organizationId, query, limit)
				: Promise.resolve([]),
			canSearchDeliverables
				? searchDeliverables(organizationId, query, limit, {
						includeClientNames: canReadRelatedClientNames,
					})
				: Promise.resolve([]),
			canSearchExpenses
				? searchExpenses(organizationId, query, limit)
				: Promise.resolve([]),
			canSearchInvoices
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
