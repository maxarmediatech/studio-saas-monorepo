import { ORPCError } from "@orpc/server";
import { and, db, discussions, eq, isNull } from "@repo/database";
import { protectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import { buildRichTextContent } from "../lib/rich-text";
import { resolveDiscussionRouteContext } from "../lib/route-context";
import { updateDiscussionInputSchema } from "../schemas";

export const updateDiscussion = protectedProcedure
	.route({
		method: "PATCH",
		path: "/discussions/posts/{discussionId}",
		tags: ["Discussions"],
		summary: "Update a discussion",
	})
	.input(updateDiscussionInputSchema)
	.handler(async ({ input, context: baseContext }) => {
		const context = await resolveDiscussionRouteContext(
			input.organizationSlug,
			baseContext,
		);

		await requirePermission(context, "discussion", "update");

		const existing = await db.query.discussions.findFirst({
			where: and(
				eq(discussions.id, input.discussionId),
				eq(discussions.organizationId, context.organizationId),
				isNull(discussions.deletedAt),
			),
		});

		if (!existing) {
			throw new ORPCError("NOT_FOUND", {
				message: "Discussion not found",
			});
		}

		const updates: Partial<typeof discussions.$inferInsert> = {
			updatedBy: context.user.id,
			updatedAt: new Date(),
		};

		if (input.title !== undefined) {
			updates.title = input.title;
		}

		if (input.content !== undefined || input.contentJson !== undefined) {
			const richText = buildRichTextContent({
				content: input.content ?? existing.content,
				contentJson: input.contentJson,
				maxBytes: 200 * 1024,
			});

			if (!richText.validation.ok) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Invalid discussion content",
				});
			}

			updates.content = richText.text || null;
			updates.contentJson = richText.json;
			updates.contentText = richText.text;
		}

		const [updated] = await db
			.update(discussions)
			.set(updates)
			.where(eq(discussions.id, input.discussionId))
			.returning();

		return { data: updated };
	});
