import { ORPCError } from "@orpc/server";
import {
	and,
	assignmentSubmissions,
	crews,
	db,
	deliverableAssignments,
	deliverables,
	eq,
	isNull,
	sql,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { trackActivity } from "../../activities/lib";
import { requirePermission } from "../../studio/lib/permissions";
import {
	submitDeliverableInputSchema,
	submitDeliverableOutputSchema,
} from "../../studio/schemas/deliverable";

export const submitDeliverable = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/deliverables/{deliverableId}/submissions",
		tags: ["Deliverables"],
		summary: "Submit deliverable for review",
		description: "Submit work on a deliverable for review",
	})
	.input(submitDeliverableInputSchema)
	.output(submitDeliverableOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "deliverable", "submit");

		const { deliverableId, submissionNote } = input;

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

		// Find crew member for the current user
		const crew = await db.query.crews.findFirst({
			where: and(
				eq(crews.organizationId, context.organizationId),
				eq(crews.userId, context.user.id),
				isNull(crews.deletedAt),
			),
		});

		if (!crew) {
			throw new ORPCError("FORBIDDEN", {
				message: "You must be a crew member to submit work",
			});
		}

		// Verify user is assigned to this deliverable
		const assignment = await db.query.deliverableAssignments.findFirst({
			where: and(
				eq(deliverableAssignments.deliverableId, deliverableId),
				eq(deliverableAssignments.crewId, crew.id),
			),
		});

		if (!assignment) {
			throw new ORPCError("FORBIDDEN", {
				message: "You are not assigned to this deliverable",
			});
		}

		// Check for existing active submission (submitted or in_review)
		const existingSubmission =
			await db.query.assignmentSubmissions.findFirst({
				where: and(
					eq(assignmentSubmissions.deliverableId, deliverableId),
					eq(assignmentSubmissions.submittedBy, crew.id),
					sql`${assignmentSubmissions.status} IN ('submitted', 'in_review')`,
				),
			});

		if (existingSubmission) {
			throw new ORPCError("CONFLICT", {
				message:
					"You already have a pending submission for this deliverable",
			});
		}

		// Create submission
		const [created] = await db
			.insert(assignmentSubmissions)
			.values({
				organizationId: context.organizationId,
				deliverableId,
				submittedBy: crew.id,
				status: "submitted",
				submissionNote: submissionNote ?? null,
				submittedAt: new Date(),
			})
			.returning({ id: assignmentSubmissions.id });

		if (!created) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create submission",
			});
		}

		// Update deliverable workflow status
		await db
			.update(deliverables)
			.set({
				workflowStatus: "submitted",
				updatedAt: new Date(),
				updatedBy: context.user.id,
			})
			.where(eq(deliverables.id, deliverableId));

		// Track activity (non-blocking)
		trackActivity(context, {
			entityType: "submission",
			entityId: created.id,
			entityName: deliverable.name,
			action: "submitted",
			parentEntityType: "deliverable",
			parentEntityId: deliverable.id,
			parentEntityName: deliverable.name,
			metadata: { crewId: crew.id, crewName: crew.name },
		}).catch(console.error);

		return {
			data: { id: created.id },
			message: "Deliverable submitted for review",
		};
	});
