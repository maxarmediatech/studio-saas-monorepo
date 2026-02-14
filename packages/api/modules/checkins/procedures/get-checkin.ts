import { checkins, db, eq } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { assertCheckinAccess } from "../lib/checkin-access";
import { getCheckinInputSchema } from "../schemas";

export const getCheckin = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/checkins/posts/{checkinId}",
		tags: ["Checkins"],
		summary: "Get a checkin by ID",
	})
	.input(getCheckinInputSchema)
	.handler(async ({ input, context }) => {
		await assertCheckinAccess(input.checkinId, context);

		const checkin = await db.query.checkins.findFirst({
			where: eq(checkins.id, input.checkinId),
			with: {
				author: {
					columns: { id: true, name: true, image: true },
				},
				checkinType: {
					columns: {
						id: true,
						name: true,
						emoji: true,
						scope: true,
					},
					with: {
						team: {
							columns: { id: true, name: true },
						},
					},
				},
				links: true,
			},
		});

		return { data: checkin };
	});
