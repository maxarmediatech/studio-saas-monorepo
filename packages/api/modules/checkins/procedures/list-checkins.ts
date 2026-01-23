import { and, checkins, db, desc, eq, isNull, lt, or } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { assertCheckinTypeAccess } from "../lib/checkin-access";
import { listCheckinsInputSchema } from "../schemas";

export const listCheckins = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/checkins/posts",
		tags: ["Checkins"],
		summary: "List checkins for a checkin type",
	})
	.input(listCheckinsInputSchema)
	.handler(async ({ input, context }) => {
		await assertCheckinTypeAccess(input.checkinTypeId, context);

		const cursorFilter = input.cursor
			? or(
					lt(
						checkins.checkinDate,
						new Date(input.cursor.checkinDate),
					),
					and(
						eq(
							checkins.checkinDate,
							new Date(input.cursor.checkinDate),
						),
						lt(checkins.id, input.cursor.id),
					),
				)
			: undefined;

		const result = await db.query.checkins.findMany({
			columns: {
				id: true,
				content: true,
				contentText: true,
				contentJson: true,
				checkinDate: true,
				commentCount: true,
				createdAt: true,
			},
			where: and(
				eq(checkins.checkinTypeId, input.checkinTypeId),
				eq(checkins.organizationId, context.organizationId),
				isNull(checkins.deletedAt),
				cursorFilter,
			),
			with: {
				author: {
					columns: { id: true, name: true, image: true },
				},
				links: true,
			},
			orderBy: [desc(checkins.checkinDate), desc(checkins.id)],
			limit: input.limit + 1,
		});

		const hasMore = result.length > input.limit;
		const items = hasMore ? result.slice(0, -1) : result;
		const lastItem = items[items.length - 1];
		const nextCursor =
			hasMore && lastItem
				? {
						checkinDate:
							lastItem.checkinDate instanceof Date
								? lastItem.checkinDate
										.toISOString()
										.split("T")[0]
								: lastItem.checkinDate,
						id: lastItem.id,
					}
				: undefined;

		return { data: items, nextCursor, hasMore };
	});
