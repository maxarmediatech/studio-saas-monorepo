import { ORPCError } from "@orpc/server";
import { hasAnyRole } from "@repo/auth/lib/permissions";
import { checkinComments, checkins, db, eq, sql } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { deleteCommentInputSchema } from "../schemas";

export const deleteComment = studioProtectedProcedure
	.route({
		method: "DELETE",
		path: "/checkins/comments/{commentId}",
		tags: ["Checkins"],
		summary: "Delete a comment (soft delete)",
	})
	.input(deleteCommentInputSchema)
	.handler(async ({ input, context }) => {
		const comment = await db.query.checkinComments.findFirst({
			where: eq(checkinComments.id, input.commentId),
		});

		if (!comment) {
			throw new ORPCError("NOT_FOUND", { message: "Comment not found" });
		}

		const isAdmin = hasAnyRole(context.membership.role, ["owner", "admin"]);
		if (comment.createdBy !== context.user.id && !isAdmin) {
			throw new ORPCError("FORBIDDEN", {
				message: "You can only delete your own comments",
			});
		}

		await db.transaction(async (tx) => {
			await tx
				.update(checkinComments)
				.set({
					deletedAt: new Date(),
					deletedBy: context.user.id,
				})
				.where(eq(checkinComments.id, input.commentId));

			await tx
				.update(checkins)
				.set({
					commentCount: sql`GREATEST(${checkins.commentCount} - 1, 0)`,
				})
				.where(eq(checkins.id, comment.checkinId));

			if (comment.parentId && comment.threadRootId) {
				await tx
					.update(checkinComments)
					.set({
						replyCount: sql`GREATEST(${checkinComments.replyCount} - 1, 0)`,
					})
					.where(eq(checkinComments.id, comment.threadRootId));
			}
		});

		return { success: true };
	});
