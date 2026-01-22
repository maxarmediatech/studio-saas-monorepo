import { checkinTypes, db, eq } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { assertCheckinTypeAccess } from "../lib/checkin-access";
import { deleteCheckinTypeInputSchema } from "../schemas";

export const deleteCheckinType = studioProtectedProcedure
	.route({
		method: "DELETE",
		path: "/checkins/types/{checkinTypeId}",
		tags: ["Checkins"],
		summary: "Delete a checkin type (soft delete)",
	})
	.input(deleteCheckinTypeInputSchema)
	.handler(async ({ input, context }) => {
		await assertCheckinTypeAccess(input.checkinTypeId, context);

		await db
			.update(checkinTypes)
			.set({
				deletedAt: new Date(),
				deletedBy: context.user.id,
			})
			.where(eq(checkinTypes.id, input.checkinTypeId));

		return { success: true };
	});
