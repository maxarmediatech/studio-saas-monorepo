import { ORPCError } from "@orpc/server";
import { db, discussionLinks, discussions } from "@repo/database";
import { protectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import { assertChannelAccess } from "../lib/channel-access";
import { buildRichTextContent } from "../lib/rich-text";
import { resolveDiscussionRouteContext } from "../lib/route-context";
import { verifyLinkEntityExists } from "../lib/verify-link-entity";
import { createDiscussionInputSchema } from "../schemas";

export const createDiscussion = protectedProcedure
	.route({
		method: "POST",
		path: "/discussions/posts",
		tags: ["Discussions"],
		summary: "Create a new discussion",
	})
	.input(createDiscussionInputSchema)
	.handler(async ({ input, context: baseContext }) => {
		const context = await resolveDiscussionRouteContext(
			input.organizationSlug,
			baseContext,
		);

		await requirePermission(context, "discussion", "create");
		await assertChannelAccess(input.channelId, context);

		if (input.links?.length) {
			for (const link of input.links) {
				const exists = await verifyLinkEntityExists(
					link.entityType,
					link.entityId,
					context,
				);
				if (!exists) {
					throw new ORPCError("BAD_REQUEST", {
						message: `Linked ${link.entityType} not found or access denied`,
					});
				}
			}
		}

		return await db.transaction(async (tx) => {
			let derivedContent:
				| {
						content: string | null;
						contentJson: unknown;
						contentText: string;
				  }
				| undefined;

			if (input.content || input.contentJson) {
				const richText = buildRichTextContent({
					content: input.content,
					contentJson: input.contentJson,
					maxBytes: 200 * 1024,
				});

				if (!richText.validation.ok) {
					throw new ORPCError("BAD_REQUEST", {
						message: "Invalid discussion content",
					});
				}

				derivedContent = {
					content: richText.text || null,
					contentJson: richText.json,
					contentText: richText.text,
				};
			}

			const [discussion] = await tx
				.insert(discussions)
				.values({
					organizationId: context.organizationId,
					channelId: input.channelId,
					title: input.title,
					content: derivedContent?.content ?? input.content ?? null,
					contentJson: derivedContent?.contentJson ?? null,
					contentText: derivedContent?.contentText ?? null,
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
