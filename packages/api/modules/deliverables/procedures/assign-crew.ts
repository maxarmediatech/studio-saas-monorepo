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
import { requirePermission } from "../../studio/lib/permissions";
import {
	assignCrewToDeliverableInputSchema,
	assignCrewToDeliverableOutputSchema,
} from "../../studio/schemas/deliverable";

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
		requirePermission(context, "deliverable", "assign");

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

		// Create assignment
		const [created] = await db
			.insert(deliverableAssignments)
			.values({
				deliverableId,
				crewId,
				isLead: isLead ?? false,
				assignedBy: context.user.id,
			})
			.returning({ id: deliverableAssignments.id });

		if (!created) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create assignment",
			});
		}

		// Update workflow status if first assignment
		if (deliverable.workflowStatus === "not_started") {
			await db
				.update(deliverables)
				.set({
					workflowStatus: "assigned",
					updatedAt: new Date(),
					updatedBy: context.user.id,
				})
				.where(eq(deliverables.id, deliverableId));
		}

		return {
			data: { id: created.id },
			message: "Crew member assigned to deliverable",
		};
	});
