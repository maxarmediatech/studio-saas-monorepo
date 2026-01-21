import { ORPCError } from "@orpc/server";
import { and, channels, db, eq, isNull } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import { deleteChannelInputSchema } from "../schemas";

export const deleteChannel = studioProtectedProcedure
	.route({
		method: "DELETE",
		path: "/discussions/channels/{channelId}",
		tags: ["Discussions"],
		summary: "Delete a channel (soft delete)",
	})
	.input(deleteChannelInputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "channel", "delete");

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

		await db
			.update(channels)
			.set({
				deletedAt: new Date(),
				deletedBy: context.user.id,
			})
			.where(eq(channels.id, input.channelId));

		return { success: true };
	});
