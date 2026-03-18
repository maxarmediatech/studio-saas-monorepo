import { ORPCError } from "@orpc/server";
import {
	and,
	db,
	discussionLinks,
	discussions,
	eq,
	isNull,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import { verifyLinkEntityExists } from "../lib/verify-link-entity";
import { addDiscussionLinkInputSchema } from "../schemas";

export const addDiscussionLink = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/discussions/posts/{discussionId}/links",
		tags: ["Discussions"],
		summary: "Add a link to a discussion",
	})
	.input(addDiscussionLinkInputSchema)
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

		const exists = await verifyLinkEntityExists(
			input.entityType,
			input.entityId,
			context,
		);

		if (!exists) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Linked ${input.entityType} not found or access denied`,
			});
		}

		const [link] = await db
			.insert(discussionLinks)
			.values({
				discussionId: input.discussionId,
				organizationId: context.organizationId,
				entityType: input.entityType,
				entityId: input.entityId,
				createdBy: context.user.id,
			})
			.onConflictDoNothing()
			.returning();

		return { data: link };
	});
