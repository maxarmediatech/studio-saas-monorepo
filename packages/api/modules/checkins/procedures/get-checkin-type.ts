import { checkinTypes, db, eq } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { assertCheckinTypeAccess } from "../lib/checkin-access";
import { getCheckinTypeInputSchema } from "../schemas";

export const getCheckinType = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/checkins/types/{checkinTypeId}",
		tags: ["Checkins"],
		summary: "Get a checkin type by ID",
	})
	.input(getCheckinTypeInputSchema)
	.handler(async ({ input, context }) => {
		await assertCheckinTypeAccess(input.checkinTypeId, context);

		const checkinType = await db.query.checkinTypes.findFirst({
			where: eq(checkinTypes.id, input.checkinTypeId),
			with: {
				team: {
					columns: { id: true, name: true },
				},
				creator: {
					columns: { id: true, name: true, image: true },
				},
			},
		});

		return { data: checkinType };
	});
