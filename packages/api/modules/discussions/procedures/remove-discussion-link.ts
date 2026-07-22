import { ORPCError } from "@orpc/server";
import { db, discussionLinks, eq } from "@repo/database";
import { organizationRouteMiddleware } from "../../../orpc/organization-route";
import { protectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import { removeDiscussionLinkInputSchema } from "../schemas";

export const removeDiscussionLink = protectedProcedure
	.route({
		method: "DELETE",
		path: "/discussions/links/{linkId}",
		tags: ["Discussions"],
		summary: "Remove a link from a discussion",
	})
	.input(removeDiscussionLinkInputSchema)
	.use(organizationRouteMiddleware, (input) => input.organizationSlug)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "discussion", "update");

		const link = await db.query.discussionLinks.findFirst({
			where: eq(discussionLinks.id, input.linkId),
			with: {
				discussion: true,
			},
		});

		if (!link) {
			throw new ORPCError("NOT_FOUND", { message: "Link not found" });
		}

		if (link.organizationId !== context.organizationId) {
			throw new ORPCError("FORBIDDEN", { message: "Access denied" });
		}

		await db
			.delete(discussionLinks)
			.where(eq(discussionLinks.id, input.linkId));

		return { success: true };
	});
