import { ORPCError } from "@orpc/server";
import { and, channels, db, eq, isNull } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import { updateChannelInputSchema } from "../schemas";

export const updateChannel = studioProtectedProcedure
	.route({
		method: "PATCH",
		path: "/discussions/channels/{channelId}",
		tags: ["Discussions"],
		summary: "Update a channel",
	})
	.input(updateChannelInputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "channel", "update");

		const existing = await db.query.channels.findFirst({
			where: and(
				eq(channels.id, input.channelId),
				eq(channels.organizationId, context.organizationId),
				isNull(channels.deletedAt),
			),
		});

		if (!existing) {
			throw new ORPCError("NOT_FOUND", { message: "Channel not found" });
		}

		const [updated] = await db
			.update(channels)
			.set({
				name: input.name ?? existing.name,
				description: input.description ?? existing.description,
				isArchived: input.isArchived ?? existing.isArchived,
				updatedBy: context.user.id,
				updatedAt: new Date(),
			})
			.where(eq(channels.id, input.channelId))
			.returning();

		return { data: updated };
	});
