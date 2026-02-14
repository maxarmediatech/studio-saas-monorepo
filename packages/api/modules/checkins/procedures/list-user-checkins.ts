import {
	and,
	checkinTypes,
	checkins,
	db,
	desc,
	eq,
	gte,
	inArray,
	isNull,
	lt,
	lte,
	or,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { canViewAllCheckins, getTeamsForUser } from "../lib/checkin-access";
import { listUserCheckinsInputSchema } from "../schemas";

export const listUserCheckins = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/checkins/user/{userId}",
		tags: ["Checkins"],
		summary: "List checkins by a user (for crew detail page)",
	})
	.input(listUserCheckinsInputSchema)
	.handler(async ({ input, context }) => {
		const isAdmin = canViewAllCheckins(context.membership.role);
		const isOwnProfile = input.userId === context.user.id;
		let allowedCheckinTypeIds: string[] | undefined;

		if (!isAdmin && !isOwnProfile) {
			const requestorTeams = await getTeamsForUser(
				context.user.id,
				context.organizationId,
			);
			const targetTeams = await getTeamsForUser(
				input.userId,
				context.organizationId,
			);

			const sharedTeams = requestorTeams.filter((t) =>
				targetTeams.includes(t),
			);

			const visibleTypes = await db.query.checkinTypes.findMany({
				columns: { id: true },
				where: and(
					eq(checkinTypes.organizationId, context.organizationId),
					isNull(checkinTypes.deletedAt),
					sharedTeams.length === 0
						? eq(checkinTypes.scope, "organization")
						: or(
								eq(checkinTypes.scope, "organization"),
								inArray(checkinTypes.teamId, sharedTeams),
							),
				),
			});

			allowedCheckinTypeIds = visibleTypes.map((item) => item.id);

			if (allowedCheckinTypeIds.length === 0) {
				return { data: [], nextCursor: undefined, hasMore: false };
			}
		}

		const dateFromFilter = input.dateFrom
			? gte(checkins.checkinDate, new Date(input.dateFrom))
			: undefined;

		const dateToFilter = input.dateTo
			? lte(checkins.checkinDate, new Date(input.dateTo))
			: undefined;

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
				eq(checkins.createdBy, input.userId),
				eq(checkins.organizationId, context.organizationId),
				isNull(checkins.deletedAt),
				allowedCheckinTypeIds
					? inArray(checkins.checkinTypeId, allowedCheckinTypeIds)
					: undefined,
				dateFromFilter,
				dateToFilter,
				cursorFilter,
			),
			with: {
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
