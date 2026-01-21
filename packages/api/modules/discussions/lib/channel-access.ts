import { ORPCError } from "@orpc/server";
import { and, channelMembers, channels, db, eq, isNull } from "@repo/database";

interface ChannelAccessContext {
	organizationId: string;
	user: { id: string };
}

export async function assertChannelAccess(
	channelId: string,
	context: ChannelAccessContext,
): Promise<typeof channels.$inferSelect> {
	const channel = await db.query.channels.findFirst({
		where: and(
			eq(channels.id, channelId),
			eq(channels.organizationId, context.organizationId),
			isNull(channels.deletedAt),
		),
		with: {
			members: {
				where: eq(channelMembers.userId, context.user.id),
				limit: 1,
			},
		},
	});

	if (!channel) {
		throw new ORPCError("NOT_FOUND", { message: "Channel not found" });
	}

	if (channel.visibility === "private") {
		const isMember = channel.members.length > 0;
		if (!isMember) {
			throw new ORPCError("FORBIDDEN", {
				message: "You don't have access to this private channel",
			});
		}
	}

	return channel;
}

export async function getChannelBySlugWithAccess(
	slug: string,
	context: ChannelAccessContext,
): Promise<typeof channels.$inferSelect> {
	const channel = await db.query.channels.findFirst({
		where: and(
			eq(channels.slug, slug),
			eq(channels.organizationId, context.organizationId),
			isNull(channels.deletedAt),
		),
		with: {
			members: {
				where: eq(channelMembers.userId, context.user.id),
				limit: 1,
			},
		},
	});

	if (!channel) {
		throw new ORPCError("NOT_FOUND", { message: "Channel not found" });
	}

	if (channel.visibility === "private" && channel.members.length === 0) {
		throw new ORPCError("FORBIDDEN", {
			message: "You don't have access to this private channel",
		});
	}

	return channel;
}
