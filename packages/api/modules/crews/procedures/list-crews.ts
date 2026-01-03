import {
	and,
	count,
	crews,
	db,
	eq,
	ilike,
	inArray,
	isNull,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import { createPaginationResponse } from "../../studio/schemas/common";
import {
	listCrewsInputSchema,
	listCrewsOutputSchema,
} from "../../studio/schemas/crew";

export const listCrews = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/crews",
		tags: ["Crews"],
		summary: "List crews",
		description:
			"List all crew members for the organization with optional filters",
	})
	.input(listCrewsInputSchema)
	.output(listCrewsOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "crew", "list");

		const {
			role,
			status,
			search,
			sortBy,
			sortDirection,
			page,
			limit,
			includeDeleted,
		} = input;
		const offset = (page - 1) * limit;

		const normalizeMultiValue = (
			value: string | string[] | null | undefined,
		): string[] | null => {
			if (!value) {
				return null;
			}

			const raw = Array.isArray(value) ? value : [value];
			const parts = raw
				.flatMap((v) => v.split(","))
				.map((v) => v.trim())
				.filter(Boolean);

			return parts.length > 0 ? parts : null;
		};

		// Build where conditions
		const conditions = [eq(crews.organizationId, context.organizationId)];

		if (!includeDeleted) {
			conditions.push(isNull(crews.deletedAt));
		}

		const roles = normalizeMultiValue(role);
		if (roles) {
			conditions.push(inArray(crews.role, roles));
		}

		const statuses = normalizeMultiValue(status);
		if (statuses) {
			conditions.push(inArray(crews.status, statuses));
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
				sortDirection === "asc"
					? [asc(orderColumn)]
					: [desc(orderColumn)],
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
