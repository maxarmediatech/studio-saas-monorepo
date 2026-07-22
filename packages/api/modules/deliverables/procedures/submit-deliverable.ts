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
import { safeNotifySubscribers } from "../../notifications/lib/notification-service";
import { requirePermission } from "../../studio/lib/permissions";
import {
	submitDeliverableInputSchema,
	submitDeliverableOutputSchema,
} from "../../studio/schemas/deliverable";
import { persistWorkSubmission } from "../../submissions/lib/persist-work-submission";

export const submitDeliverable = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/deliverables/{deliverableId}/submissions",
		tags: ["Deliverables"],
		summary: "Submit deliverable for review",
		description: "Submit or resubmit work on a deliverable for review",
	})
	.input(submitDeliverableInputSchema)
	.output(submitDeliverableOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "deliverable", "submit");
		const { deliverableId, submissionNote, submissionLinks, files } = input;
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
		if (deliverable.trackingMode === "task_based") {
			throw new ORPCError("CONFLICT", {
				message:
					"Submit work on linked tasks for task-based deliverables",
			});
		}

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

		const saved = await persistWorkSubmission(context, {
			crew: { id: crew.id, name: crew.name },
			entity: {
				id: deliverable.id,
				name: deliverable.name,
				type: "deliverable",
			},
			files,
			submissionLinks,
			submissionNote,
		});

		await safeNotifySubscribers({
			organizationId: context.organizationId,
			entityType: "deliverable",
			entityId: deliverable.id,
			entityName: deliverable.name,
			type: "review_requested",
			title: `Deliverable ${saved.wasResubmitted ? "resubmitted" : "submitted"} for review: ${deliverable.name}`,
			body: `Submitted by ${crew.name}`,
			metadata: {
				submittedByName: crew.name,
			},
			actorId: context.user.id,
			actorName: context.user.name,
			excludeUserId: context.user.id,
		});

		return {
			data: { id: saved.id },
			message: saved.wasResubmitted
				? "Deliverable resubmitted for review"
				: "Deliverable submitted for review",
		};
	});
