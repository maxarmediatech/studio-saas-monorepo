import { ORPCError } from "@orpc/server";
import { checkinLinks, db } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { verifyLinkEntityExists } from "../../discussions/lib/verify-link-entity";
import { assertCheckinOwnership } from "../lib/checkin-access";
import { addCheckinLinkInputSchema } from "../schemas";

export const addCheckinLink = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/checkins/links",
		tags: ["Checkins"],
		summary: "Add a link to a checkin",
	})
	.input(addCheckinLinkInputSchema)
	.handler(async ({ input, context }) => {
		await assertCheckinOwnership(input.checkinId, context);

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
			.insert(checkinLinks)
			.values({
				checkinId: input.checkinId,
				organizationId: context.organizationId,
				entityType: input.entityType,
				entityId: input.entityId,
				createdBy: context.user.id,
			})
			.onConflictDoNothing()
			.returning();

		return { data: link };
	});
