import { ORPCError } from "@orpc/server";
import { and, channelMembers, channels, db, eq, isNull } from "@repo/database";
import { protectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import { resolveDiscussionRouteContext } from "../lib/route-context";
import { removeChannelMemberInputSchema } from "../schemas";

export const removeChannelMember = protectedProcedure
	.route({
		method: "DELETE",
		path: "/discussions/channels/{channelId}/members/{userId}",
		tags: ["Discussions"],
		summary: "Remove a member from a channel",
	})
	.input(removeChannelMemberInputSchema)
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

		await db
			.delete(channelMembers)
			.where(
				and(
					eq(channelMembers.channelId, input.channelId),
					eq(channelMembers.userId, input.userId),
				),
			);

		return { success: true };
	});
