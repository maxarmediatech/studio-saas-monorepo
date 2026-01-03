import { ORPCError } from "@orpc/server";
import { and, db, eq, isNull, shootAssignments, shoots } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	unassignCrewInputSchema,
	unassignCrewOutputSchema,
} from "../../studio/schemas/shoot";

export const unassignCrew = studioProtectedProcedure
	.route({
		method: "DELETE",
		path: "/shoots/{shootId}/assignments/{crewId}",
		tags: ["Shoots"],
		summary: "Unassign crew from shoot",
		description: "Remove a crew member's assignment from a shoot",
	})
	.input(unassignCrewInputSchema)
	.output(unassignCrewOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "shoot", "assign");

		const { shootId, crewId } = input;

		// Verify shoot exists and belongs to organization
		const shoot = await db.query.shoots.findFirst({
			where: and(
				eq(shoots.id, shootId),
				eq(shoots.organizationId, context.organizationId),
				isNull(shoots.deletedAt),
			),
		});

		if (!shoot) {
			throw new ORPCError("NOT_FOUND", {
				message: "Shoot not found",
			});
		}

		// Find the assignment
		const assignment = await db.query.shootAssignments.findFirst({
			where: and(
				eq(shootAssignments.shootId, shootId),
				eq(shootAssignments.crewId, crewId),
			),
		});

		if (!assignment) {
			throw new ORPCError("NOT_FOUND", {
				message: "Assignment not found",
			});
		}

		// Delete assignment
		await db
			.delete(shootAssignments)
			.where(eq(shootAssignments.id, assignment.id));

		return {
			data: { id: assignment.id },
			message: "Crew member unassigned from shoot",
		};
	});
