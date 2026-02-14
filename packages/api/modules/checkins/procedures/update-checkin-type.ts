import { ORPCError } from "@orpc/server";
import { hasAnyRole } from "@repo/auth/lib/permissions";
import { checkinTypes, db, eq } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	assertCheckinTypeAccess,
	assertTeamExistsInOrganization,
	assertUserIsMemberOfTeam,
} from "../lib/checkin-access";
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
		const existing = await assertCheckinTypeAccess(input.checkinTypeId, context);
		const isAdmin = hasAnyRole(context.membership.role, ["owner", "admin"]);

		const nextScope = input.scope ?? existing.scope;
		let nextTeamId = input.teamId === undefined ? existing.teamId : input.teamId;
		const scopeChanged = nextScope !== existing.scope;
		const teamChanged = nextTeamId !== existing.teamId;

		if (!isAdmin && existing.scope === "organization") {
			throw new ORPCError("FORBIDDEN", {
				message: "Only admins can update organization-wide checkins",
			});
		}

		if (!isAdmin && (scopeChanged || teamChanged)) {
			throw new ORPCError("FORBIDDEN", {
				message: "Only admins can change checkin visibility or team",
			});
		}

		if (nextScope === "team") {
			if (!nextTeamId) {
				throw new ORPCError("BAD_REQUEST", {
					message: "teamId is required for team-scoped checkins",
				});
			}

			await assertTeamExistsInOrganization(nextTeamId, context.organizationId);

			if (!isAdmin) {
				await assertUserIsMemberOfTeam(nextTeamId, context.user.id);
			}
		} else {
			nextTeamId = null;
		}

		const { checkinTypeId, scope: _scope, teamId: _teamId, ...updateData } =
			input;

		const [updated] = await db
			.update(checkinTypes)
			.set({
				...updateData,
				scope: nextScope,
				teamId: nextTeamId,
				updatedBy: context.user.id,
				updatedAt: new Date(),
			})
			.where(eq(checkinTypes.id, checkinTypeId))
			.returning();

		return { data: updated };
	});
