import { ORPCError } from "@orpc/server";
import { and, db, discussions, eq, isNull } from "@repo/database";
import { organizationRouteMiddleware } from "../../../orpc/organization-route";
import { protectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import { resolveDiscussionInputSchema } from "../schemas";

export const resolveDiscussion = protectedProcedure
	.route({
		method: "POST",
		path: "/discussions/posts/{discussionId}/resolve",
		tags: ["Discussions"],
		summary: "Resolve a discussion",
	})
	.input(resolveDiscussionInputSchema)
	.use(organizationRouteMiddleware, (input) => input.organizationSlug)
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

		if (discussion.status === "resolved") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Discussion is already resolved",
			});
		}

		const [updated] = await db
			.update(discussions)
			.set({
				status: "resolved",
				resolution: input.resolution,
				resolvedBy: context.user.id,
				resolvedAt: new Date(),
				updatedBy: context.user.id,
				updatedAt: new Date(),
			})
			.where(eq(discussions.id, input.discussionId))
			.returning();

		return { data: updated };
	});
