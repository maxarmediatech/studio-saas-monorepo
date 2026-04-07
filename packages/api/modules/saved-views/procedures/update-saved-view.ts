import { ORPCError } from "@orpc/server";
import { and, db, eq, inArray, savedViews } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	updateSavedViewInputSchema,
	updateSavedViewOutputSchema,
} from "../../studio/schemas/saved-view";
import { listAuthorizedSavedViewEntityTypes } from "../lib/saved-view-permissions";

export const updateSavedView = studioProtectedProcedure
	.route({
		method: "PUT",
		path: "/saved-views/{id}",
		tags: ["Saved Views"],
		summary: "Update saved view",
		description:
			"Update an existing saved view (cannot update system views)",
	})
	.input(updateSavedViewInputSchema)
	.output(updateSavedViewOutputSchema)
	.handler(async ({ input, context }) => {
		const { organizationId } = context;
		const userId = context.user.id;
		const { id, ...updates } = input;
		const allowedEntityTypes = await listAuthorizedSavedViewEntityTypes(
			context,
			"update",
		);

		if (allowedEntityTypes.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: "View not found" });
		}

		const existing = await db.query.savedViews.findFirst({
			where: and(
				eq(savedViews.id, id),
				eq(savedViews.organizationId, organizationId),
				inArray(savedViews.entityType, allowedEntityTypes),
			),
		});

		if (!existing) {
			throw new ORPCError("NOT_FOUND", { message: "View not found" });
		}

		if (existing.isSystem) {
			throw new ORPCError("FORBIDDEN", {
				message: "Cannot modify system views",
			});
		}

		if (existing.createdBy !== userId && !existing.isPublic) {
			throw new ORPCError("FORBIDDEN", {
				message: "Cannot modify this view",
			});
		}

		const updateData: Record<string, unknown> = { updatedAt: new Date() };

		if (updates.name !== undefined) {
			updateData.name = updates.name;
		}
		if (updates.description !== undefined) {
			updateData.description = updates.description;
		}
		if (updates.icon !== undefined) {
			updateData.icon = updates.icon;
		}
		if (updates.color !== undefined) {
			updateData.color = updates.color;
		}
		if (updates.filters !== undefined) {
			updateData.filters = updates.filters;
		}
		if (updates.displayFilters !== undefined) {
			updateData.displayFilters = updates.displayFilters;
		}
		if (updates.columnVisibility !== undefined) {
			updateData.columnVisibility = updates.columnVisibility;
		}
		if (updates.sorting !== undefined) {
			updateData.sorting = updates.sorting;
		}
		if (updates.isPublic !== undefined) {
			updateData.isPublic = updates.isPublic;
		}

		await db
			.update(savedViews)
			.set(updateData)
			.where(eq(savedViews.id, id));

		return {
			data: { id },
			message: "View updated successfully",
		};
	});
