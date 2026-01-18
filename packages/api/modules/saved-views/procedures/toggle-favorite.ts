import { and, db, eq, savedViewFavorites, savedViews } from "@repo/database";
import { ORPCError } from "@orpc/server";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	toggleFavoriteInputSchema,
	toggleFavoriteOutputSchema,
} from "../../studio/schemas/saved-view";

export const toggleFavorite = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/saved-views/{viewId}/favorite",
		tags: ["Saved Views"],
		summary: "Toggle favorite",
		description: "Add or remove a view from favorites",
	})
	.input(toggleFavoriteInputSchema)
	.output(toggleFavoriteOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "booking", "list");

		const { organizationId } = context;
		const userId = context.user.id;
		const { viewId } = input;

		const view = await db.query.savedViews.findFirst({
			where: and(
				eq(savedViews.id, viewId),
				eq(savedViews.organizationId, organizationId),
			),
		});

		if (!view) {
			throw new ORPCError("NOT_FOUND", { message: "View not found" });
		}

		const existingFavorite = await db.query.savedViewFavorites.findFirst({
			where: and(
				eq(savedViewFavorites.savedViewId, viewId),
				eq(savedViewFavorites.userId, userId),
			),
		});

		if (existingFavorite) {
			await db
				.delete(savedViewFavorites)
				.where(eq(savedViewFavorites.id, existingFavorite.id));

			return {
				data: { isFavorite: false },
				message: "Removed from favorites",
			};
		}

		await db.insert(savedViewFavorites).values({
			savedViewId: viewId,
			userId,
		});

		return {
			data: { isFavorite: true },
			message: "Added to favorites",
		};
	});
