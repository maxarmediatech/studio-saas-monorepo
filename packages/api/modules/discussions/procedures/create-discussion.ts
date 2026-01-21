import { ORPCError } from "@orpc/server";
import { db, discussionLinks, discussions } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import { assertChannelAccess } from "../lib/channel-access";
import { verifyLinkEntityExists } from "../lib/verify-link-entity";
import { createDiscussionInputSchema } from "../schemas";

export const createDiscussion = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/discussions/posts",
		tags: ["Discussions"],
		summary: "Create a new discussion",
	})
	.input(createDiscussionInputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "discussion", "create");
		await assertChannelAccess(input.channelId, context);

		if (input.links?.length) {
			for (const link of input.links) {
				const exists = await verifyLinkEntityExists(
					link.entityType,
					link.entityId,
					context.organizationId,
				);
				if (!exists) {
					throw new ORPCError("BAD_REQUEST", {
						message: `Linked ${link.entityType} not found or access denied`,
					});
				}
			}
		}

		return await db.transaction(async (tx) => {
			const [discussion] = await tx
				.insert(discussions)
				.values({
					organizationId: context.organizationId,
					channelId: input.channelId,
					title: input.title,
					content: input.content,
					createdBy: context.user.id,
					updatedBy: context.user.id,
					lastActivityAt: new Date(),
				})
				.returning();

			if (input.links?.length) {
				await tx.insert(discussionLinks).values(
					input.links.map((link) => ({
						discussionId: discussion.id,
						organizationId: context.organizationId,
						entityType: link.entityType,
						entityId: link.entityId,
						createdBy: context.user.id,
					})),
				);
			}

			return { data: discussion };
		});
	});
