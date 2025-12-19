import { and, count, eq, ilike, isNull, crews, db } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	listCrewsInputSchema,
	listCrewsOutputSchema,
} from "../../studio/schemas/crew";
import { createPaginationResponse } from "../../studio/schemas/common";

export const listCrews = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/crews",
		tags: ["Crews"],
		summary: "List crews",
		description: "List all crew members for the organization with optional filters",
	})
	.input(listCrewsInputSchema)
	.output(listCrewsOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "crew", "list");

		const { role, status, search, sortBy, sortDirection, page, limit, includeDeleted } = input;
		const offset = (page - 1) * limit;

		// Build where conditions
		const conditions = [eq(crews.organizationId, context.organizationId)];

		if (!includeDeleted) {
			conditions.push(isNull(crews.deletedAt));
		}

		if (role) {
			conditions.push(eq(crews.role, role));
		}

		if (status) {
			conditions.push(eq(crews.status, status));
		}

		if (search) {
			conditions.push(ilike(crews.name, `%${search}%`));
		}

		// Get total count
		const [countResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(crews)
			.where(and(...conditions));

		const total = countResult?.count ?? 0;

		// Get crews with sorting
		const orderColumn =
			sortBy === "name"
				? crews.name
				: sortBy === "role"
					? crews.role
					: sortBy === "status"
						? crews.status
						: sortBy === "updatedAt"
							? crews.updatedAt
							: crews.createdAt;

		const data = await db.query.crews.findMany({
			where: and(...conditions),
			orderBy: (table, { asc, desc }) =>
				sortDirection === "asc" ? [asc(orderColumn)] : [desc(orderColumn)],
			limit,
			offset,
		});

		return {
			data: data.map((crew) => ({
				...crew,
				metadata: crew.metadata as Record<string, unknown> | null,
				createdAt: crew.createdAt.toISOString(),
				updatedAt: crew.updatedAt.toISOString(),
				deletedAt: crew.deletedAt?.toISOString() ?? null,
			})),
			pagination: createPaginationResponse(page, limit, total),
		};
	});
