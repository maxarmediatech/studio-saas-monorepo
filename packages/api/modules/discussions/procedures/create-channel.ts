import { channelMembers, channels, db } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import { createChannelInputSchema } from "../schemas";

function slugify(text: string): string {
	return text
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, "")
		.replace(/[\s_-]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export const createChannel = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/discussions/channels",
		tags: ["Discussions"],
		summary: "Create a new channel",
	})
	.input(createChannelInputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "channel", "create");

		const slug = slugify(input.name);

		const [channel] = await db.transaction(async (tx) => {
			const [created] = await tx
				.insert(channels)
				.values({
					organizationId: context.organizationId,
					name: input.name,
					slug,
					description: input.description,
					emoji: input.emoji ?? "💬",
					visibility: input.visibility,
					createdBy: context.user.id,
					updatedBy: context.user.id,
				})
				.returning();

			await tx.insert(channelMembers).values({
				channelId: created.id,
				userId: context.user.id,
				isSubscribed: true,
			});

			return [created];
		});

		return { data: channel };
	});
