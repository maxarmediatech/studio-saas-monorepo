import { and, channelMembers, db, eq } from "@repo/database";
import { organizationRouteMiddleware } from "../../../orpc/organization-route";
import { protectedProcedure } from "../../../orpc/procedures";
import { assertChannelAccess } from "../lib/channel-access";
import { toggleSubscriptionInputSchema } from "../schemas";

export const toggleSubscription = protectedProcedure
	.route({
		method: "PATCH",
		path: "/discussions/channels/{channelId}/subscription",
		tags: ["Discussions"],
		summary: "Toggle subscription to a channel",
	})
	.input(toggleSubscriptionInputSchema)
	.use(organizationRouteMiddleware, (input) => input.organizationSlug)
	.handler(async ({ input, context }) => {
		await assertChannelAccess(input.channelId, context);

		const existing = await db.query.channelMembers.findFirst({
			where: and(
				eq(channelMembers.channelId, input.channelId),
				eq(channelMembers.userId, context.user.id),
			),
		});

		if (existing) {
			const [updated] = await db
				.update(channelMembers)
				.set({ isSubscribed: input.isSubscribed })
				.where(eq(channelMembers.id, existing.id))
				.returning();
			return { data: updated };
		}

		const [created] = await db
			.insert(channelMembers)
			.values({
				channelId: input.channelId,
				userId: context.user.id,
				isSubscribed: input.isSubscribed,
			})
			.returning();

		return { data: created };
	});
