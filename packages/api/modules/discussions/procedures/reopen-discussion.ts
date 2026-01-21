import { ORPCError } from "@orpc/server";
import { and, db, discussions, eq, isNull } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import { reopenDiscussionInputSchema } from "../schemas";

export const reopenDiscussion = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/discussions/posts/{discussionId}/reopen",
		tags: ["Discussions"],
		summary: "Reopen a resolved discussion",
	})
	.input(reopenDiscussionInputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "discussion", "update");

		const discussion = await db.query.discussions.findFirst({
			where: and(
				eq(discussions.id, input.discussionId),
				eq(discussions.organizationId, context.organizationId),
				isNull(discussions.deletedAt),
			),
		});

		if (!discussion) {
			throw new ORPCError("NOT_FOUND", {
				message: "Discussion not found",
			});
		}

		if (discussion.status === "open") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Discussion is already open",
			});
		}

		const [updated] = await db
			.update(discussions)
			.set({
				status: "open",
				resolution: null,
				resolvedBy: null,
				resolvedAt: null,
				updatedBy: context.user.id,
				updatedAt: new Date(),
			})
			.where(eq(discussions.id, input.discussionId))
			.returning();

		return { data: updated };
	});
