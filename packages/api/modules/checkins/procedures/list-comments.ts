import { and, asc, checkinComments, db, eq, isNull } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { assertCheckinAccess } from "../lib/checkin-access";
import { listCommentsInputSchema } from "../schemas";

export const listComments = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/checkins/comments",
		tags: ["Checkins"],
		summary: "List comments for a checkin",
	})
	.input(listCommentsInputSchema)
	.handler(async ({ input, context }) => {
		await assertCheckinAccess(input.checkinId, context);

		const threadFilter = input.threadRootId
			? eq(checkinComments.threadRootId, input.threadRootId)
			: isNull(checkinComments.parentId);

		const result = await db.query.checkinComments.findMany({
			where: and(
				eq(checkinComments.checkinId, input.checkinId),
				isNull(checkinComments.deletedAt),
				threadFilter,
			),
			with: {
				author: {
					columns: { id: true, name: true, image: true },
				},
				replies: {
					where: isNull(checkinComments.deletedAt),
					with: {
						author: {
							columns: { id: true, name: true, image: true },
						},
					},
					orderBy: [asc(checkinComments.createdAt)],
					limit: 3,
				},
			},
			orderBy: [asc(checkinComments.createdAt)],
		});

		return { data: result };
	});
