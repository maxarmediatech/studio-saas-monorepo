import { ORPCError } from "@orpc/server";
import { hasAnyRole } from "@repo/auth/lib/permissions";
import { checkinComments, db, eq } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { buildRichTextContent } from "../../discussions/lib/rich-text";
import { updateCommentInputSchema } from "../schemas";

export const updateComment = studioProtectedProcedure
	.route({
		method: "PATCH",
		path: "/checkins/comments/{commentId}",
		tags: ["Checkins"],
		summary: "Update a comment",
	})
	.input(updateCommentInputSchema)
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
				message: "You can only edit your own comments",
			});
		}

		const richText = buildRichTextContent({
			content: input.content,
			contentJson: input.contentJson,
			maxBytes: 50 * 1024,
		});

		if (!richText.validation.ok) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Invalid comment content",
			});
		}

		const [updated] = await db
			.update(checkinComments)
			.set({
				content: richText.text,
				contentJson: richText.json,
				contentText: richText.text,
				updatedBy: context.user.id,
				updatedAt: new Date(),
			})
			.where(eq(checkinComments.id, input.commentId))
			.returning();

		return { data: updated };
	});
