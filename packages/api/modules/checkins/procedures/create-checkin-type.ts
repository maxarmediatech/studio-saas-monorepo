import { ORPCError } from "@orpc/server";
import { hasAnyRole } from "@repo/auth/lib/permissions";
import { and, checkinTypes, db, eq, teamMembers } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
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

		if (!isAdmin) {
			const teamMembership = await db.query.teamMembers.findFirst({
				where: and(
					eq(teamMembers.teamId, input.teamId),
					eq(teamMembers.userId, context.user.id),
				),
			});

			if (!teamMembership) {
				throw new ORPCError("FORBIDDEN", {
					message: "Not a member of this team",
				});
			}
		}

		const [checkinType] = await db
			.insert(checkinTypes)
			.values({
				organizationId: context.organizationId,
				teamId: input.teamId,
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
