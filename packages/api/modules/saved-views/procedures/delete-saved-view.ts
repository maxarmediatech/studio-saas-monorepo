import { ORPCError } from "@orpc/server";
import { and, db, eq, inArray, savedViews } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	deleteSavedViewInputSchema,
	deleteSavedViewOutputSchema,
} from "../../studio/schemas/saved-view";
import { listAuthorizedSavedViewEntityTypes } from "../lib/saved-view-permissions";

export const deleteSavedView = studioProtectedProcedure
	.route({
		method: "DELETE",
		path: "/saved-views/{id}",
		tags: ["Saved Views"],
		summary: "Delete saved view",
		description: "Delete a saved view (cannot delete system views)",
	})
	.input(deleteSavedViewInputSchema)
	.output(deleteSavedViewOutputSchema)
	.handler(async ({ input, context }) => {
		const { organizationId } = context;
		const userId = context.user.id;
		const { id } = input;
		const allowedEntityTypes = await listAuthorizedSavedViewEntityTypes(
			context,
			"delete",
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
				message: "Cannot delete system views",
			});
		}

		if (existing.createdBy !== userId) {
			throw new ORPCError("FORBIDDEN", {
				message: "Cannot delete this view",
			});
		}

		await db.delete(savedViews).where(eq(savedViews.id, id));

		return {
			data: { id },
			message: "View deleted successfully",
		};
	});
