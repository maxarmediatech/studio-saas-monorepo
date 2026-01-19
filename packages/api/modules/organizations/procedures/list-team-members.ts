import { ORPCError } from "@orpc/server";
import { and, db, eq, teamMembers, teams } from "@repo/database";
import { z } from "zod";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";

export const listTeamMembers = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/organizations/teams/members",
		tags: ["Organizations", "Teams"],
		summary: "List team members",
		description: "List members for a team in the active organization",
	})
	.input(
		z.object({
			teamId: z.string(),
		}),
	)
	.output(
		z.array(
			z.object({
				id: z.string(),
				teamId: z.string(),
				userId: z.string(),
				createdAt: z.date(),
			}),
		),
	)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "team", "read");

		const team = await db.query.teams.findFirst({
			where: and(
				eq(teams.id, input.teamId),
				eq(teams.organizationId, context.organizationId),
			),
		});

		if (!team) {
			throw new ORPCError("NOT_FOUND", {
				message: "Team not found",
			});
		}

		return db.query.teamMembers.findMany({
			where: eq(teamMembers.teamId, input.teamId),
			orderBy: (table, { asc }) => [asc(table.createdAt)],
		});
	});
