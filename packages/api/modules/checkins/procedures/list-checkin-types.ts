import {
	and,
	checkinTypes,
	db,
	eq,
	inArray,
	isNull,
	or,
} from "@repo/database";
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
		const scopeFilter = input.scope
			? eq(checkinTypes.scope, input.scope)
			: undefined;

		let visibilityFilter:
			| ReturnType<typeof eq>
			| ReturnType<typeof or>
			| ReturnType<typeof inArray>
			| undefined;

		if (input.teamId) {
			if (!isAdmin) {
				const userTeamIds = await getTeamsForUser(
					context.user.id,
					context.organizationId,
				);
				if (!userTeamIds.includes(input.teamId)) {
					return { data: [] };
				}
			}
			visibilityFilter = eq(checkinTypes.teamId, input.teamId);
		} else if (!isAdmin) {
			const userTeamIds = await getTeamsForUser(
				context.user.id,
				context.organizationId,
			);
			visibilityFilter =
				userTeamIds.length === 0
					? eq(checkinTypes.scope, "organization")
					: or(
							eq(checkinTypes.scope, "organization"),
							inArray(checkinTypes.teamId, userTeamIds),
						);
		}

		const activeFilter = input.includeInactive
			? undefined
			: eq(checkinTypes.isActive, true);

		const result = await db.query.checkinTypes.findMany({
			where: and(
				eq(checkinTypes.organizationId, context.organizationId),
				isNull(checkinTypes.deletedAt),
				scopeFilter,
				visibilityFilter,
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
