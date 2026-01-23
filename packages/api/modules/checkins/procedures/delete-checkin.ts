import { checkins, db, eq } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { assertCheckinOwnership } from "../lib/checkin-access";
import { deleteCheckinInputSchema } from "../schemas";

export const deleteCheckin = studioProtectedProcedure
	.route({
		method: "DELETE",
		path: "/checkins/posts/{checkinId}",
		tags: ["Checkins"],
		summary: "Delete a checkin (soft delete)",
	})
	.input(deleteCheckinInputSchema)
	.handler(async ({ input, context }) => {
		await assertCheckinOwnership(input.checkinId, context);

		await db
			.update(checkins)
			.set({
				deletedAt: new Date(),
				deletedBy: context.user.id,
			})
			.where(eq(checkins.id, input.checkinId));

		return { success: true };
	});
