import { ORPCError } from "@orpc/server";
import { hasAnyRole } from "@repo/auth/lib/permissions";
import { checkinTypes, db } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	assertTeamExistsInOrganization,
	assertUserIsMemberOfTeam,
} from "../lib/checkin-access";
import { createCheckinTypeInputSchema } from "../schemas";

export const createCheckinType = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/checkins/types",
		tags: ["Checkins"],
		summary: "Create a new checkin type",
	})
	.input(createCheckinTypeInputSchema)
	.handler(async ({ input, context }) => {
		const isAdmin = hasAnyRole(context.membership.role, ["owner", "admin"]);
		const isTeamScoped = input.scope === "team";
		const teamId = input.teamId;

		if (!isAdmin && !isTeamScoped) {
			throw new ORPCError("FORBIDDEN", {
				message: "Only admins can create organization-wide checkins",
			});
		}

		if (isTeamScoped && !teamId) {
			throw new ORPCError("BAD_REQUEST", {
				message: "teamId is required for team-scoped checkins",
			});
		}

		if (isTeamScoped && teamId) {
			await assertTeamExistsInOrganization(teamId, context.organizationId);

			if (!isAdmin) {
				await assertUserIsMemberOfTeam(teamId, context.user.id);
			}
		}

		const [checkinType] = await db
			.insert(checkinTypes)
			.values({
				organizationId: context.organizationId,
				scope: input.scope,
				teamId: isTeamScoped ? teamId! : null,
				name: input.name,
				emoji: input.emoji,
				description: input.description,
				frequency: input.frequency,
				scheduledTime: input.scheduledTime,
				createdBy: context.user.id,
				updatedBy: context.user.id,
			})
			.returning();

		return { data: checkinType };
	});
