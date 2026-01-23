import { and, db, desc, discussions, eq, isNull, lt, or } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { assertChannelAccess } from "../lib/channel-access";
import { listDiscussionsInputSchema } from "../schemas";

export const listDiscussions = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/discussions/posts",
		tags: ["Discussions"],
		summary: "List discussions in a channel",
	})
	.input(listDiscussionsInputSchema)
	.handler(async ({ input, context }) => {
		await assertChannelAccess(input.channelId, context);

		const statusFilter =
			input.status === "all"
				? undefined
				: eq(discussions.status, input.status as "open" | "resolved");

		const cursorFilter = input.cursor
			? or(
					lt(discussions.createdAt, new Date(input.cursor.createdAt)),
					and(
						eq(
							discussions.createdAt,
							new Date(input.cursor.createdAt),
						),
						lt(discussions.id, input.cursor.id),
					),
				)
			: undefined;

		const orderBy =
			input.sortBy === "activity"
				? [desc(discussions.lastActivityAt), desc(discussions.id)]
				: [desc(discussions.createdAt), desc(discussions.id)];

		const result = await db.query.discussions.findMany({
			columns: {
				id: true,
				title: true,
				content: true,
				contentText: true,
				status: true,
				createdAt: true,
				lastActivityAt: true,
				messageCount: true,
			},
			where: and(
				eq(discussions.channelId, input.channelId),
				eq(discussions.organizationId, context.organizationId),
				isNull(discussions.deletedAt),
				statusFilter,
				cursorFilter,
			),
			with: {
				author: {
					columns: { id: true, name: true, image: true },
				},
			},
			orderBy,
			limit: input.limit + 1,
		});

		const hasMore = result.length > input.limit;
		const items = hasMore ? result.slice(0, -1) : result;
		const lastItem = items[items.length - 1];
		const nextCursor =
			hasMore && lastItem
				? {
						createdAt: lastItem.createdAt.toISOString(),
						id: lastItem.id,
					}
				: undefined;

		return { data: items, nextCursor, hasMore };
	});
