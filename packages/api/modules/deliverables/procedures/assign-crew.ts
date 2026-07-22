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
import {
	safeAutoSubscribe,
	safeNotifySubscribers,
} from "../../notifications/lib/notification-service";
import { requirePermission } from "../../studio/lib/permissions";
import {
	assignCrewToDeliverableInputSchema,
	assignCrewToDeliverableOutputSchema,
} from "../../studio/schemas/deliverable";
import {
	lockParentReviewEvidence,
	lockSubmissionParent,
	recomputeParentReviewAggregate,
} from "../../submissions/lib/parent-review-aggregate";

export const assignCrewToDeliverable = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/deliverables/{deliverableId}/assignments",
		tags: ["Deliverables"],
		summary: "Assign crew to deliverable",
		description: "Assign a crew member to work on a deliverable",
	})
	.input(assignCrewToDeliverableInputSchema)
	.output(assignCrewToDeliverableOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "deliverable", "assign");

		const { deliverableId, crewId, isLead } = input;

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
		const existingAssignment =
			await db.query.deliverableAssignments.findFirst({
				where: and(
					eq(deliverableAssignments.deliverableId, deliverableId),
					eq(deliverableAssignments.crewId, crewId),
				),
			});

		if (existingAssignment) {
			throw new ORPCError("CONFLICT", {
				message: "Crew member is already assigned to this deliverable",
			});
		}

		const created = await db.transaction(async (tx) => {
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
			if (parent.trackingMode === "task_based") {
				throw new ORPCError("CONFLICT", {
					message:
						"Crew is assigned to linked tasks for task-based deliverables",
				});
			}
			await lockParentReviewEvidence(tx, context.organizationId, parent);
			const duplicate = await tx.query.deliverableAssignments.findFirst({
				where: and(
					eq(deliverableAssignments.deliverableId, deliverableId),
					eq(deliverableAssignments.crewId, crewId),
				),
				columns: { id: true },
			});
			if (duplicate) {
				throw new ORPCError("CONFLICT", {
					message:
						"Crew member is already assigned to this deliverable",
				});
			}
			const [assignment] = await tx
				.insert(deliverableAssignments)
				.values({
					deliverableId,
					crewId,
					isLead: isLead ?? false,
					assignedBy: context.user.id,
				})
				.returning({ id: deliverableAssignments.id });
			if (!assignment) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Failed to create assignment",
				});
			}
			await recomputeParentReviewAggregate(tx, context, parent, {
				actionTime: new Date(),
				cause: "assignment_added",
			});
			return assignment;
		});

		// Track activity (non-blocking)
		// entityName = target of assignment (deliverable), crewName in metadata
		await safeTrackAssignment(context, {
			entityType: "deliverable_assignment",
			entityId: created.id,
			entityName: deliverable.name,
			action: "assigned",
			parentEntityType: "deliverable",
			parentEntityId: deliverable.id,
			parentEntityName: deliverable.name,
			metadata: {
				crewId: crew.id,
				crewName: crew.name,
				isLead: isLead ?? false,
			},
		});

		if (crew.userId) {
			await safeAutoSubscribe({
				organizationId: context.organizationId,
				userId: crew.userId,
				entityType: "deliverable",
				entityId: deliverable.id,
			});
		}

		await safeNotifySubscribers({
			organizationId: context.organizationId,
			entityType: "deliverable",
			entityId: deliverable.id,
			entityName: deliverable.name,
			type: "assigned",
			title: `Deliverable assigned: ${deliverable.name}`,
			body: `Assigned to ${crew.name}`,
			metadata: {
				assigneeName: crew.name,
				assigneeId: crew.userId ?? null,
			},
			actorId: context.user.id,
			actorName: context.user.name,
			excludeUserId: context.user.id,
		});

		return {
			data: { id: created.id },
			message: "Crew member assigned to deliverable",
		};
	});
