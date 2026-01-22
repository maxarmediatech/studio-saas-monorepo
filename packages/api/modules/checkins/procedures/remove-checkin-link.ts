import { ORPCError } from "@orpc/server";
import { checkinLinks, db, eq } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { assertCheckinOwnership } from "../lib/checkin-access";
import { removeCheckinLinkInputSchema } from "../schemas";

export const removeCheckinLink = studioProtectedProcedure
	.route({
		method: "DELETE",
		path: "/checkins/links/{linkId}",
		tags: ["Checkins"],
		summary: "Remove a link from a checkin",
	})
	.input(removeCheckinLinkInputSchema)
	.handler(async ({ input, context }) => {
		const link = await db.query.checkinLinks.findFirst({
			where: eq(checkinLinks.id, input.linkId),
		});

		if (!link) {
			throw new ORPCError("NOT_FOUND", { message: "Link not found" });
		}

		await assertCheckinOwnership(link.checkinId, context);

		await db.delete(checkinLinks).where(eq(checkinLinks.id, input.linkId));

		return { success: true };
	});
