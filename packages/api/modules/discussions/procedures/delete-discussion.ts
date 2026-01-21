import { ORPCError } from "@orpc/server";
import { and, db, discussions, eq, isNull } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import { deleteDiscussionInputSchema } from "../schemas";

export const deleteDiscussion = studioProtectedProcedure
	.route({
		method: "DELETE",
		path: "/discussions/posts/{discussionId}",
		tags: ["Discussions"],
		summary: "Delete a discussion (soft delete)",
	})
	.input(deleteDiscussionInputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "discussion", "delete");

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

		await db
			.update(discussions)
			.set({
				deletedAt: new Date(),
				deletedBy: context.user.id,
			})
			.where(eq(discussions.id, input.discussionId));

		return { success: true };
	});
