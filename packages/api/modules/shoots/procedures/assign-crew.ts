import { ORPCError } from "@orpc/server";
import {
	and,
	crews,
	db,
	eq,
	isNull,
	shootAssignments,
	shoots,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	assignCrewInputSchema,
	assignCrewOutputSchema,
} from "../../studio/schemas/shoot";

export const assignCrew = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/shoots/{shootId}/assignments",
		tags: ["Shoots"],
		summary: "Assign crew to shoot",
		description: "Assign a crew member to a shoot",
	})
	.input(assignCrewInputSchema)
	.output(assignCrewOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "shoot", "assign");

		const { shootId, crewId, role, isLead, rate } = input;

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

		// Verify crew exists and belongs to organization
		const crew = await db.query.crews.findFirst({
			where: and(
				eq(crews.id, crewId),
				eq(crews.organizationId, context.organizationId),
				isNull(crews.deletedAt),
			),
		});

		if (!crew) {
			throw new ORPCError("NOT_FOUND", {
				message: "Crew member not found",
			});
		}

		// Check if already assigned
		const existing = await db.query.shootAssignments.findFirst({
			where: and(
				eq(shootAssignments.shootId, shootId),
				eq(shootAssignments.crewId, crewId),
			),
		});

		if (existing) {
			throw new ORPCError("CONFLICT", {
				message: "Crew member is already assigned to this shoot",
			});
		}

		const assignmentRole = role || crew.role || "Crew";

		const [created] = await db
			.insert(shootAssignments)
			.values({
				shootId,
				crewId,
				role: assignmentRole,
				isLead: isLead ?? false,
				rate: rate ?? null,
				assignedBy: context.user.id,
			})
			.returning({ id: shootAssignments.id });

		if (!created) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to assign crew",
			});
		}

		return {
			data: { id: created.id },
			message: `${crew.name} assigned to shoot`,
		};
	});
