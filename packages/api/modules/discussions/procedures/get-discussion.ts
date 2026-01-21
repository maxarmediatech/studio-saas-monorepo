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
import { getDiscussionInputSchema } from "../schemas";

export const getDiscussion = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/discussions/posts/{discussionId}",
		tags: ["Discussions"],
		summary: "Get discussion by ID",
	})
	.input(getDiscussionInputSchema)
	.handler(async ({ input, context }) => {
		const discussion = await db.query.discussions.findFirst({
			where: and(
				eq(discussions.id, input.discussionId),
				eq(discussions.organizationId, context.organizationId),
				isNull(discussions.deletedAt),
			),
			with: {
				author: {
					columns: { id: true, name: true, image: true },
				},
				resolver: {
					columns: { id: true, name: true, image: true },
				},
				channel: {
					columns: { id: true, name: true, slug: true },
				},
				links: true,
				messages: {
					where: and(
						isNull(discussionMessages.parentId),
						isNull(discussionMessages.deletedAt),
					),
					with: {
						author: {
							columns: { id: true, name: true, image: true },
						},
						replies: {
							where: isNull(discussionMessages.deletedAt),
							with: {
								author: {
									columns: {
										id: true,
										name: true,
										image: true,
									},
								},
							},
							orderBy: (m, { asc }) => [asc(m.createdAt)],
						},
					},
					orderBy: (m, { asc }) => [asc(m.createdAt)],
				},
			},
		});

		if (!discussion) {
			throw new ORPCError("NOT_FOUND", {
				message: "Discussion not found",
			});
		}

		return { data: discussion };
	});
