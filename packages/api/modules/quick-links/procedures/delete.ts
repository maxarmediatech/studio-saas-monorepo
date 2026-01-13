import { ORPCError } from "@orpc/server";
import { and, db, eq, quickLinks } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	deleteQuickLinkInputSchema,
	deleteQuickLinkOutputSchema,
} from "../schemas";

export const deleteQuickLink = studioProtectedProcedure
	.route({
		method: "DELETE",
		path: "/quick-links/{id}",
		tags: ["Quick Links"],
		summary: "Delete quick link",
		description: "Delete a quick link",
	})
	.input(deleteQuickLinkInputSchema)
	.output(deleteQuickLinkOutputSchema)
	.handler(async ({ input, context }) => {
		const { organizationId, user } = context;
		const userId = user.id;

		const result = await db
			.delete(quickLinks)
			.where(
				and(
					eq(quickLinks.id, input.id),
					eq(quickLinks.organizationId, organizationId),
					eq(quickLinks.userId, userId),
				),
			)
			.returning({ id: quickLinks.id });

		if (result.length === 0) {
			throw new ORPCError("NOT_FOUND", {
				message: "Quick link not found",
			});
		}

		return { success: true };
	});
