import { db, savedViews } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	createSavedViewInputSchema,
	createSavedViewOutputSchema,
} from "../../studio/schemas/saved-view";
import { requireSavedViewPermission } from "../lib/saved-view-permissions";

export const createSavedView = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/saved-views",
		tags: ["Saved Views"],
		summary: "Create saved view",
		description: "Create a new custom saved view",
	})
	.input(createSavedViewInputSchema)
	.output(createSavedViewOutputSchema)
	.handler(async ({ input, context }) => {
		await requireSavedViewPermission(context, input.entityType, "create");

		const { organizationId } = context;
		const userId = context.user.id;

		const [created] = await db
			.insert(savedViews)
			.values({
				organizationId,
				createdBy: userId,
				entityType: input.entityType,
				name: input.name,
				description: input.description ?? null,
				icon: input.icon ?? null,
				color: input.color ?? null,
				filters: input.filters ?? {},
				displayFilters: input.displayFilters ?? null,
				columnVisibility: input.columnVisibility ?? null,
				sorting: input.sorting ?? null,
				isSystem: false,
				isDefault: false,
				isPublic: input.isPublic ?? false,
				sortOrder: 100,
			})
			.returning({ id: savedViews.id });

		return {
			data: { id: created.id },
			message: "View created successfully",
		};
	});
