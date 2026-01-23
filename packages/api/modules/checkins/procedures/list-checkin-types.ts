import { and, checkinTypes, db, eq, inArray, isNull } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { canViewAllCheckins, getTeamsForUser } from "../lib/checkin-access";
import { listCheckinTypesInputSchema } from "../schemas";

export const listCheckinTypes = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/checkins/types",
		tags: ["Checkins"],
		summary: "List checkin types",
	})
	.input(listCheckinTypesInputSchema)
	.handler(async ({ input, context }) => {
		const isAdmin = canViewAllCheckins(context.membership.role);

		let teamFilter:
			| ReturnType<typeof eq>
			| ReturnType<typeof inArray>
			| undefined;

		if (input.teamId) {
			teamFilter = eq(checkinTypes.teamId, input.teamId);
		} else if (!isAdmin) {
			const userTeamIds = await getTeamsForUser(
				context.user.id,
				context.organizationId,
			);
			if (userTeamIds.length === 0) {
				return { data: [] };
			}
			teamFilter = inArray(checkinTypes.teamId, userTeamIds);
		}

		const activeFilter = input.includeInactive
			? undefined
			: eq(checkinTypes.isActive, true);

		const result = await db.query.checkinTypes.findMany({
			where: and(
				eq(checkinTypes.organizationId, context.organizationId),
				isNull(checkinTypes.deletedAt),
				teamFilter,
				activeFilter,
			),
			with: {
				team: {
					columns: { id: true, name: true },
				},
				creator: {
					columns: { id: true, name: true, image: true },
				},
			},
			orderBy: (t, { asc }) => [asc(t.name)],
		});

		return { data: result };
	});
