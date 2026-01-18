import { and, configurations, count, db, eq, ilike } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import { createPaginationResponse } from "../../studio/schemas/common";
import {
	listConfigurationsInputSchema,
	listConfigurationsOutputSchema,
} from "../../studio/schemas/configuration";

export const listConfigurations = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/configurations",
		tags: ["Configurations"],
		summary: "List configurations",
		description:
			"List all configurations for the organization, optionally filtered by type",
	})
	.input(listConfigurationsInputSchema)
	.output(listConfigurationsOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "configuration", "list");

		const { type, search, sortBy, sortDirection, page, limit } = input;
		const offset = (page - 1) * limit;

		// Build where conditions
		const conditions = [
			eq(configurations.organizationId, context.organizationId),
		];

		if (type) {
			conditions.push(eq(configurations.type, type));
		}

		if (search) {
			conditions.push(ilike(configurations.label, `%${search}%`));
		}

		// Get total count
		const [countResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(configurations)
			.where(and(...conditions));

		const total = countResult?.count ?? 0;

		// Get configurations with sorting
		const orderColumn =
			sortBy === "label"
				? configurations.label
				: sortBy === "createdAt"
					? configurations.createdAt
					: configurations.sortOrder;

		const data = await db.query.configurations.findMany({
			where: and(...conditions),
			orderBy: (table, { asc, desc }) =>
				sortDirection === "asc"
					? [asc(orderColumn)]
					: [desc(orderColumn)],
			limit,
			offset,
		});

		return {
			data: data.map((config) => ({
				...config,
				metadata: config.metadata as Record<string, unknown> | null,
				createdAt: config.createdAt.toISOString(),
				updatedAt: config.updatedAt.toISOString(),
			})),
			pagination: createPaginationResponse(page, limit, total),
		};
	});
