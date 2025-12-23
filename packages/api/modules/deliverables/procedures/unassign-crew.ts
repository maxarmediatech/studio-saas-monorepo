import { ORPCError } from "@orpc/server";
import {
	and,
	count,
	eq,
	isNull,
	deliverables,
	deliverableAssignments,
	db,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
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

		// Delete the assignment
		await db
			.delete(deliverableAssignments)
			.where(eq(deliverableAssignments.id, assignment.id));

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
