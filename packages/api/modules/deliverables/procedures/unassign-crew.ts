import { ORPCError } from "@orpc/server";
import {
	and,
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
import {
	lockParentReviewEvidence,
	lockSubmissionParent,
	recomputeParentReviewAggregate,
} from "../../submissions/lib/parent-review-aggregate";

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
		await requirePermission(context, "deliverable", "assign");

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

		const removed = await db.transaction(async (tx) => {
			const parent = await lockSubmissionParent(
				tx,
				context.organizationId,
				{ id: deliverableId, type: "deliverable" },
			);
			if (!parent) {
				throw new ORPCError("NOT_FOUND", {
					message: "Deliverable not found",
				});
			}
			await lockParentReviewEvidence(tx, context.organizationId, parent);
			const current = await tx.query.deliverableAssignments.findFirst({
				where: and(
					eq(deliverableAssignments.deliverableId, deliverableId),
					eq(deliverableAssignments.crewId, crewId),
				),
				columns: { id: true },
			});
			if (!current) {
				throw new ORPCError("NOT_FOUND", {
					message: "Assignment not found",
				});
			}
			await tx
				.delete(deliverableAssignments)
				.where(eq(deliverableAssignments.id, current.id));
			await recomputeParentReviewAggregate(tx, context, parent, {
				actionTime: new Date(),
				cause: "assignment_removed",
			});
			return current;
		});

		// Track activity (non-blocking)
		// entityName = target of assignment (deliverable), crewName in metadata
		if (crew) {
			await safeTrackAssignment(context, {
				entityType: "deliverable_assignment",
				entityId: removed.id,
				entityName: deliverable.name,
				action: "unassigned",
				parentEntityType: "deliverable",
				parentEntityId: deliverable.id,
				parentEntityName: deliverable.name,
				metadata: { crewId: crew.id, crewName: crew.name },
			});
		}

		return {
			data: { id: removed.id },
			message: "Crew member unassigned from deliverable",
		};
	});
