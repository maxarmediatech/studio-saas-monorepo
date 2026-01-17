import { ORPCError } from "@orpc/server";
import {
	and,
	count,
	crews,
	db,
	deliverableAssignments,
	deliverables,
	eq,
	isNull,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { safeTrackAssignment } from "../../activities/lib";
import { requirePermission } from "../../studio/lib/permissions";
import {
	unassignCrewFromDeliverableInputSchema,
	unassignCrewFromDeliverableOutputSchema,
} from "../../studio/schemas/deliverable";

export const unassignCrewFromDeliverable = studioProtectedProcedure
	.route({
		method: "DELETE",
		path: "/deliverables/{deliverableId}/assignments/{crewId}",
		tags: ["Deliverables"],
		summary: "Unassign crew from deliverable",
		description: "Remove a crew member from a deliverable",
	})
	.input(unassignCrewFromDeliverableInputSchema)
	.output(unassignCrewFromDeliverableOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "deliverable", "assign");

		const { deliverableId, crewId } = input;

		// Verify deliverable exists and belongs to organization
		const deliverable = await db.query.deliverables.findFirst({
			where: and(
				eq(deliverables.id, deliverableId),
				eq(deliverables.organizationId, context.organizationId),
				isNull(deliverables.deletedAt),
			),
		});

		if (!deliverable) {
			throw new ORPCError("NOT_FOUND", {
				message: "Deliverable not found",
			});
		}

		// Find the assignment
		const assignment = await db.query.deliverableAssignments.findFirst({
			where: and(
				eq(deliverableAssignments.deliverableId, deliverableId),
				eq(deliverableAssignments.crewId, crewId),
			),
		});

		if (!assignment) {
			throw new ORPCError("NOT_FOUND", {
				message: "Assignment not found",
			});
		}

		// Get crew info for activity tracking
		const crew = await db.query.crews.findFirst({
			where: eq(crews.id, crewId),
			columns: { id: true, name: true },
		});

		// Delete the assignment
		await db
			.delete(deliverableAssignments)
			.where(eq(deliverableAssignments.id, assignment.id));

		// Track activity (non-blocking)
		// entityName = target of assignment (deliverable), crewName in metadata
		if (crew) {
			await safeTrackAssignment(context, {
				entityType: "deliverable_assignment",
				entityId: assignment.id,
				entityName: deliverable.name,
				action: "unassigned",
				parentEntityType: "deliverable",
				parentEntityId: deliverable.id,
				parentEntityName: deliverable.name,
				metadata: { crewId: crew.id, crewName: crew.name },
			});
		}

		// Check if there are any remaining assignments
		const [remainingCount] = await db
			.select({ count: count().mapWith(Number) })
			.from(deliverableAssignments)
			.where(eq(deliverableAssignments.deliverableId, deliverableId));

		// If no assignments remain and workflow is "assigned", revert to "not_started"
		if (
			remainingCount?.count === 0 &&
			deliverable.workflowStatus === "assigned"
		) {
			await db
				.update(deliverables)
				.set({
					workflowStatus: "not_started",
					updatedAt: new Date(),
					updatedBy: context.user.id,
				})
				.where(eq(deliverables.id, deliverableId));
		}

		return {
			data: { id: assignment.id },
			message: "Crew member unassigned from deliverable",
		};
	});
