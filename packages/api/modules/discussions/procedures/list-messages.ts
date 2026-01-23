import { ORPCError } from "@orpc/server";
import {
	and,
	db,
	discussionMessages,
	discussions,
	eq,
	isNull,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { listMessagesInputSchema } from "../schemas";

export const listMessages = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/discussions/messages",
		tags: ["Discussions"],
		summary: "List messages for a discussion",
	})
	.input(listMessagesInputSchema)
	.handler(async ({ input, context }) => {
		const discussion = await db.query.discussions.findFirst({
			where: and(
				eq(discussions.id, input.discussionId),
				eq(discussions.organizationId, context.organizationId),
				isNull(discussions.deletedAt),
			),
		});

		if (!discussion) {
			throw new ORPCError("NOT_FOUND", {
				message: "Discussion not found",
			});
		}

		const whereClause = input.threadRootId
			? and(
					eq(discussionMessages.discussionId, input.discussionId),
					eq(discussionMessages.threadRootId, input.threadRootId),
					isNull(discussionMessages.deletedAt),
				)
			: and(
					eq(discussionMessages.discussionId, input.discussionId),
					isNull(discussionMessages.parentId),
					isNull(discussionMessages.deletedAt),
				);

		const messages = await db.query.discussionMessages.findMany({
			where: whereClause,
			with: {
				author: {
					columns: { id: true, name: true, image: true },
				},
				replies: input.threadRootId
					? undefined
					: {
							where: isNull(discussionMessages.deletedAt),
							limit: 3,
							orderBy: (m, { asc }) => [asc(m.createdAt)],
							with: {
								author: {
									columns: {
										id: true,
										name: true,
										image: true,
									},
								},
							},
						},
			},
			orderBy: (m, { asc }) => [asc(m.createdAt)],
		});

		return { data: messages };
	});
