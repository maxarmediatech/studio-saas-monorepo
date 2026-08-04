import { and, clients, count, db, eq, ilike, isNull } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	listClientsInputSchema,
	listClientsOutputSchema,
} from "../../studio/schemas/client";
import { createPaginationResponse } from "../../studio/schemas/common";

export const listClients = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/clients",
		tags: ["Clients"],
		summary: "List clients",
		description:
			"List all clients for the organization with optional filters",
	})
	.input(listClientsInputSchema)
	.output(listClientsOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "client", "list");

		const {
			search,
			sortBy,
			sortDirection,
			page,
			limit,
			includeDeleted,
			lifecycleStage,
		} = input;
		const offset = (page - 1) * limit;

		// Build where conditions
		const conditions = [
			eq(clients.organizationId, context.organizationId),
			eq(clients.lifecycleStage, lifecycleStage),
		];

		if (!includeDeleted) {
			conditions.push(isNull(clients.deletedAt));
		}

		if (search) {
			conditions.push(ilike(clients.name, `%${search}%`));
		}

		// Get total count
		const [countResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(clients)
			.where(and(...conditions));

		const total = countResult?.count ?? 0;

		// Get clients with sorting
		const orderColumn =
			sortBy === "name"
				? clients.name
				: sortBy === "email"
					? clients.email
					: sortBy === "updatedAt"
						? clients.updatedAt
						: clients.createdAt;

		const data = await db.query.clients.findMany({
			where: and(...conditions),
			orderBy: (_table, { asc, desc }) =>
				sortDirection === "asc"
					? [asc(orderColumn)]
					: [desc(orderColumn)],
			limit,
			offset,
		});

		return {
			data: data.map((client) => ({
				...client,
				metadata: client.metadata as Record<string, unknown> | null,
				createdAt: client.createdAt.toISOString(),
				updatedAt: client.updatedAt.toISOString(),
				deletedAt: client.deletedAt?.toISOString() ?? null,
			})),
			pagination: createPaginationResponse(page, limit, total),
		};
	});
