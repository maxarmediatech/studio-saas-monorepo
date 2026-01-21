import { ORPCError } from "@orpc/server";
import {
	and,
	channelMembers,
	db,
	discussionMessages,
	discussions,
	eq,
	isNull,
	sql,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import { createMessageInputSchema } from "../schemas";

export const createMessage = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/discussions/messages",
		tags: ["Discussions"],
		summary: "Create a message or reply",
	})
	.input(createMessageInputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "conversation", "create");

		const discussion = await db.query.discussions.findFirst({
			where: and(
				eq(discussions.id, input.discussionId),
				eq(discussions.organizationId, context.organizationId),
				isNull(discussions.deletedAt),
			),
			with: {
				channel: {
					with: {
						members: {
							where: eq(channelMembers.userId, context.user.id),
							limit: 1,
						},
					},
				},
			},
		});

		if (!discussion) {
			throw new ORPCError("NOT_FOUND", {
				message: "Discussion not found",
			});
		}

		if (
			discussion.channel.visibility === "private" &&
			discussion.channel.members.length === 0
		) {
			throw new ORPCError("FORBIDDEN", {
				message: "You don't have access to this channel",
			});
		}

		let threadRootId: string | null = null;
		let parentId: string | null = null;

		if (input.parentId) {
			const parentMessage = await db.query.discussionMessages.findFirst({
				where: and(
					eq(discussionMessages.id, input.parentId),
					eq(discussionMessages.discussionId, input.discussionId),
					isNull(discussionMessages.deletedAt),
				),
			});

			if (!parentMessage) {
				throw new ORPCError("NOT_FOUND", {
					message: "Parent message not found",
				});
			}

			parentId = input.parentId;
			threadRootId = parentMessage.threadRootId ?? parentMessage.id;
		}

		return await db.transaction(async (tx) => {
			const [message] = await tx
				.insert(discussionMessages)
				.values({
					discussionId: input.discussionId,
					content: input.content,
					parentId,
					threadRootId,
					createdBy: context.user.id,
					updatedBy: context.user.id,
				})
				.returning();

			await tx
				.update(discussions)
				.set({
					lastActivityAt: new Date(),
					messageCount: sql`${discussions.messageCount} + 1`,
					updatedAt: new Date(),
				})
				.where(eq(discussions.id, input.discussionId));

			if (threadRootId) {
				await tx
					.update(discussionMessages)
					.set({
						replyCount: sql`${discussionMessages.replyCount} + 1`,
					})
					.where(eq(discussionMessages.id, threadRootId));
			}

			return { data: message };
		});
	});
