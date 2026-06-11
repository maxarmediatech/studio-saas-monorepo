import { ORPCError } from "@orpc/server";
import {
	and,
	db,
	discussionMessages,
	discussions,
	eq,
	isNull,
	sql,
} from "@repo/database";
import { protectedProcedure } from "../../../orpc/procedures";
import { resolveDiscussionRouteContext } from "../lib/route-context";
import { deleteMessageInputSchema } from "../schemas";

export const deleteMessage = protectedProcedure
	.route({
		method: "DELETE",
		path: "/discussions/messages/{messageId}",
		tags: ["Discussions"],
		summary: "Delete a message (soft delete)",
	})
	.input(deleteMessageInputSchema)
	.handler(async ({ input, context: baseContext }) => {
		const context = await resolveDiscussionRouteContext(
			input.organizationSlug,
			baseContext,
		);

		const message = await db.query.discussionMessages.findFirst({
			where: and(
				eq(discussionMessages.id, input.messageId),
				isNull(discussionMessages.deletedAt),
			),
			with: {
				discussion: true,
			},
		});

		if (!message) {
			throw new ORPCError("NOT_FOUND", { message: "Message not found" });
		}

		if (message.discussion.organizationId !== context.organizationId) {
			throw new ORPCError("FORBIDDEN", { message: "Access denied" });
		}

		if (message.createdBy !== context.user.id) {
			throw new ORPCError("FORBIDDEN", {
				message: "You can only delete your own messages",
			});
		}

		await db.transaction(async (tx) => {
			await tx
				.update(discussionMessages)
				.set({
					deletedAt: new Date(),
					deletedBy: context.user.id,
				})
				.where(eq(discussionMessages.id, input.messageId));

			await tx
				.update(discussions)
				.set({
					messageCount: sql`GREATEST(${discussions.messageCount} - 1, 0)`,
				})
				.where(eq(discussions.id, message.discussionId));

			if (message.threadRootId) {
				await tx
					.update(discussionMessages)
					.set({
						replyCount: sql`GREATEST(${discussionMessages.replyCount} - 1, 0)`,
					})
					.where(eq(discussionMessages.id, message.threadRootId));
			}
		});

		return { success: true };
	});
