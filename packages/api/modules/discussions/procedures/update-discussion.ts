import { ORPCError } from "@orpc/server";
import { and, db, discussions, eq, isNull } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import { updateDiscussionInputSchema } from "../schemas";

export const updateDiscussion = studioProtectedProcedure
	.route({
		method: "PATCH",
		path: "/discussions/posts/{discussionId}",
		tags: ["Discussions"],
		summary: "Update a discussion",
	})
	.input(updateDiscussionInputSchema)
	.handler(async ({ input, context }) => {
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

		const [updated] = await db
			.update(discussions)
			.set({
				title: input.title ?? existing.title,
				content: input.content ?? existing.content,
				updatedBy: context.user.id,
				updatedAt: new Date(),
			})
			.where(eq(discussions.id, input.discussionId))
			.returning();

		return { data: updated };
	});
