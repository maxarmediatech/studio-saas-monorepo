import { ORPCError } from "@orpc/server";
import { and, channelMembers, channels, db, eq, isNull } from "@repo/database";
import { protectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import { resolveDiscussionRouteContext } from "../lib/route-context";
import { addChannelMemberInputSchema } from "../schemas";

export const addChannelMember = protectedProcedure
	.route({
		method: "POST",
		path: "/discussions/channels/{channelId}/members",
		tags: ["Discussions"],
		summary: "Add a member to a channel",
	})
	.input(addChannelMemberInputSchema)
	.handler(async ({ input, context: baseContext }) => {
		const context = await resolveDiscussionRouteContext(
			input.organizationSlug,
			baseContext,
		);

		await requirePermission(context, "channel", "update");

		const channel = await db.query.channels.findFirst({
			where: and(
				eq(channels.id, input.channelId),
				eq(channels.organizationId, context.organizationId),
				isNull(channels.deletedAt),
			),
		});

		if (!channel) {
			throw new ORPCError("NOT_FOUND", { message: "Channel not found" });
		}

		const existing = await db.query.channelMembers.findFirst({
			where: and(
				eq(channelMembers.channelId, input.channelId),
				eq(channelMembers.userId, input.userId),
			),
		});

		if (existing) {
			return { data: existing };
		}

		const [member] = await db
			.insert(channelMembers)
			.values({
				channelId: input.channelId,
				userId: input.userId,
				isSubscribed: true,
			})
			.returning();

		return { data: member };
	});
