import { and, channelMembers, channels, db, eq, isNull } from "@repo/database";
import { protectedProcedure } from "../../../orpc/procedures";
import { resolveDiscussionRouteContext } from "../lib/route-context";
import { listChannelsInputSchema } from "../schemas";

export const listChannels = protectedProcedure
	.route({
		method: "GET",
		path: "/discussions/channels",
		tags: ["Discussions"],
		summary: "List channels user has access to",
	})
	.input(listChannelsInputSchema)
	.handler(async ({ input, context: baseContext }) => {
		const context = await resolveDiscussionRouteContext(
			input.organizationSlug,
			baseContext,
		);

		const result = await db.query.channels.findMany({
			where: and(
				eq(channels.organizationId, context.organizationId),
				isNull(channels.deletedAt),
				input.includeArchived
					? undefined
					: eq(channels.isArchived, false),
			),
			with: {
				members: {
					where: eq(channelMembers.userId, context.user.id),
					columns: { userId: true, isSubscribed: true },
				},
			},
			orderBy: (channels, { asc }) => [asc(channels.name)],
		});

		const data = result.map((ch) => ({
			...ch,
			isMember: ch.members.length > 0,
			isSubscribed: ch.members[0]?.isSubscribed ?? false,
			members: undefined,
		}));

		return { data };
	});
