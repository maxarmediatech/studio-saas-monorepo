import { ORPCError } from "@orpc/server";
import { checkinComments, checkins, db, eq, sql } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { buildRichTextContent } from "../../discussions/lib/rich-text";
import { assertCheckinAccess } from "../lib/checkin-access";
import { createCommentInputSchema } from "../schemas";

export const createComment = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/checkins/comments",
		tags: ["Checkins"],
		summary: "Create a comment on a checkin",
	})
	.input(createCommentInputSchema)
	.handler(async ({ input, context }) => {
		await assertCheckinAccess(input.checkinId, context);

		let threadRootId = input.parentId;

		if (input.parentId) {
			const parent = await db.query.checkinComments.findFirst({
				where: eq(checkinComments.id, input.parentId),
				columns: { id: true, threadRootId: true, checkinId: true },
			});

			if (!parent) {
				throw new ORPCError("NOT_FOUND", {
					message: "Parent comment not found",
				});
			}

			if (parent.checkinId !== input.checkinId) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Parent comment belongs to different checkin",
				});
			}

			threadRootId = parent.threadRootId ?? parent.id;
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

		return await db.transaction(async (tx) => {
			const [comment] = await tx
				.insert(checkinComments)
				.values({
					checkinId: input.checkinId,
					content: richText.text,
					contentJson: richText.json,
					contentText: richText.text,
					parentId: input.parentId,
					threadRootId,
					createdBy: context.user.id,
					updatedBy: context.user.id,
				})
				.returning();

			await tx
				.update(checkins)
				.set({
					commentCount: sql`${checkins.commentCount} + 1`,
				})
				.where(eq(checkins.id, input.checkinId));

			if (input.parentId) {
				await tx
					.update(checkinComments)
					.set({
						replyCount: sql`${checkinComments.replyCount} + 1`,
					})
					.where(
						eq(checkinComments.id, threadRootId ?? input.parentId),
					);
			}

			return { data: comment };
		});
	});
