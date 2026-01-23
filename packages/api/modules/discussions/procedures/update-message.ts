import { ORPCError } from "@orpc/server";
import { and, db, discussionMessages, eq, isNull } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { updateMessageInputSchema } from "../schemas";
import { buildRichTextContent } from "../lib/rich-text";

export const updateMessage = studioProtectedProcedure
	.route({
		method: "PATCH",
		path: "/discussions/messages/{messageId}",
		tags: ["Discussions"],
		summary: "Update a message",
	})
	.input(updateMessageInputSchema)
	.handler(async ({ input, context }) => {
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
				message: "You can only edit your own messages",
			});
		}

		const richText = buildRichTextContent({
			content: input.content,
			contentJson: input.contentJson,
			maxBytes: 50 * 1024,
		});

		if (!richText.validation.ok) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Invalid message content",
			});
		}

		if (!richText.text.trim()) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Message content cannot be empty",
			});
		}

		const [updated] = await db
			.update(discussionMessages)
			.set({
				content: richText.text,
				contentJson: richText.json,
				contentText: richText.text,
				updatedBy: context.user.id,
				updatedAt: new Date(),
			})
			.where(eq(discussionMessages.id, input.messageId))
			.returning();

		return { data: updated };
	});
