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
import { safeTrackAssignment } from "../../activities/lib";
import { requirePermission } from "../../studio/lib/permissions";
import {
	unassignCrewInputSchema,
	unassignCrewOutputSchema,
} from "../../studio/schemas/shoot";
import { enqueueCalendarCancellation } from "../lib/calendar-delivery";

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
		await requirePermission(context, "shoot", "assign");

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

		// Find the assignment with crew info
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

		// Get crew info for activity tracking + calendar handling
		const crew = await db.query.crews.findFirst({
			where: and(
				eq(crews.id, crewId),
				eq(crews.organizationId, context.organizationId),
				isNull(crews.deletedAt),
			),
			columns: { id: true, name: true, userId: true, email: true },
		});
		if (!crew) {
			throw new ORPCError("NOT_FOUND", {
				message: "Crew member not found in this organization",
			});
		}

		await db.transaction(async (tx) => {
			await enqueueCalendarCancellation(tx, {
				organizationId: context.organizationId,
				shootId,
				crewId,
			});
			await tx
				.delete(shootAssignments)
				.where(eq(shootAssignments.id, assignment.id));
		});

		// Track activity (non-blocking)
		// entityName = target of assignment (shoot), crewName in metadata
		await safeTrackAssignment(context, {
			entityType: "shoot_assignment",
			entityId: assignment.id,
			entityName: shoot.name,
			action: "unassigned",
			parentEntityType: "shoot",
			parentEntityId: shoot.id,
			parentEntityName: shoot.name,
			metadata: { crewId: crew.id, crewName: crew.name },
		});

		return {
			data: { id: assignment.id },
			message: "Crew member unassigned from shoot",
		};
	});
