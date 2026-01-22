import { checkinTypes, db, eq } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { assertCheckinTypeAccess } from "../lib/checkin-access";
import { updateCheckinTypeInputSchema } from "../schemas";

export const updateCheckinType = studioProtectedProcedure
	.route({
		method: "PATCH",
		path: "/checkins/types/{checkinTypeId}",
		tags: ["Checkins"],
		summary: "Update a checkin type",
	})
	.input(updateCheckinTypeInputSchema)
	.handler(async ({ input, context }) => {
		await assertCheckinTypeAccess(input.checkinTypeId, context);

		const { checkinTypeId, ...updateData } = input;

		const [updated] = await db
			.update(checkinTypes)
			.set({
				...updateData,
				updatedBy: context.user.id,
				updatedAt: new Date(),
			})
			.where(eq(checkinTypes.id, checkinTypeId))
			.returning();

		return { data: updated };
	});
