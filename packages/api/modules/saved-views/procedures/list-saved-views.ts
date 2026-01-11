import {
	and,
	db,
	eq,
	or,
	savedViewFavorites,
	savedViews,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	listSavedViewsInputSchema,
	listSavedViewsOutputSchema,
} from "../../studio/schemas/saved-view";
import { systemViewDefinitions } from "../system-views";

export const listSavedViews = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/saved-views",
		tags: ["Saved Views"],
		summary: "List saved views",
		description:
			"List all saved views for an entity type (system + public + user's private)",
	})
	.input(listSavedViewsInputSchema)
	.output(listSavedViewsOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "booking", "list");

		const { entityType } = input;
		const { organizationId } = context;
		const userId = context.user.id;

		const existingViews = await db.query.savedViews.findMany({
			where: and(
				eq(savedViews.organizationId, organizationId),
				eq(savedViews.entityType, entityType),
			),
		});

		if (existingViews.length === 0) {
			const systemDefs = systemViewDefinitions[entityType] || [];
			if (systemDefs.length > 0) {
				const systemViewsToInsert = systemDefs.map((def) => ({
					organizationId,
					createdBy: null,
					entityType,
					name: def.name,
					description: def.description,
					icon: def.icon,
					color: null,
					filters: def.filters,
					displayFilters: null,
					columnVisibility: null,
					sorting: null,
					isSystem: true,
					isDefault: def.isDefault ?? false,
					isPublic: true,
					sortOrder: def.sortOrder,
				}));

				await db.insert(savedViews).values(systemViewsToInsert);
			}
		}

		const views = await db.query.savedViews.findMany({
			where: and(
				eq(savedViews.organizationId, organizationId),
				eq(savedViews.entityType, entityType),
				or(
					eq(savedViews.isSystem, true),
					eq(savedViews.isPublic, true),
					eq(savedViews.createdBy, userId),
				),
			),
			orderBy: (table, { asc }) => [
				asc(table.sortOrder),
				asc(table.name),
			],
			with: {
				createdByUser: {
					columns: { id: true, name: true, image: true },
				},
			},
		});

		const favoriteRows = await db
			.select({ savedViewId: savedViewFavorites.savedViewId })
			.from(savedViewFavorites)
			.where(eq(savedViewFavorites.userId, userId));

		const favoriteSet = new Set(favoriteRows.map((r) => r.savedViewId));

		return {
			data: views.map((view) => ({
				id: view.id,
				organizationId: view.organizationId,
				createdBy: view.createdBy,
				entityType: view.entityType as typeof entityType,
				name: view.name,
				description: view.description,
				icon: view.icon,
				color: view.color,
				filters: (view.filters ?? {}) as Record<string, unknown>,
				displayFilters: view.displayFilters as Record<
					string,
					unknown
				> | null,
				columnVisibility: view.columnVisibility as Record<
					string,
					boolean
				> | null,
				sorting: view.sorting as Array<{
					id: string;
					desc: boolean;
				}> | null,
				isSystem: view.isSystem,
				isDefault: view.isDefault,
				isPublic: view.isPublic,
				sortOrder: view.sortOrder,
				createdAt: view.createdAt.toISOString(),
				updatedAt: view.updatedAt.toISOString(),
				isFavorite: favoriteSet.has(view.id),
				createdByUser: view.createdByUser ?? null,
			})),
		};
	});
