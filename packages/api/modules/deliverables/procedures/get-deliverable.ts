import { ORPCError } from "@orpc/server";
import {
	and,
	asc,
	bookings,
	crews,
	db,
	deliverableAssignments,
	deliverables,
	deliverableTaskLinks,
	eq,
	isNull,
	tasks,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	type DeliverableAssignmentWithCrew,
	getDeliverableInputSchema,
	getDeliverableOutputSchema,
} from "../../studio/schemas/deliverable";

export const getDeliverable = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/deliverables/{id}",
		tags: ["Deliverables"],
		summary: "Get deliverable",
		description: "Get detailed information about a specific deliverable",
	})
	.input(getDeliverableInputSchema)
	.output(getDeliverableOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "deliverable", "read");

		const { id } = input;

		// Get deliverable with booking info
		const result = await db
			.select({
				id: deliverables.id,
				organizationId: deliverables.organizationId,
				bookingId: deliverables.bookingId,
				name: deliverables.name,
				description: deliverables.description,
				quantity: deliverables.quantity,
				cost: deliverables.cost,
				isPackageIncluded: deliverables.isPackageIncluded,
				status: deliverables.status,
				workflowStatus: deliverables.workflowStatus,
				trackingMode: deliverables.trackingMode,
				dueDate: deliverables.dueDate,
				completedAt: deliverables.completedAt,
				deliveredAt: deliverables.deliveredAt,
				metadata: deliverables.metadata,
				createdBy: deliverables.createdBy,
				updatedBy: deliverables.updatedBy,
				createdAt: deliverables.createdAt,
				updatedAt: deliverables.updatedAt,
				deletedAt: deliverables.deletedAt,
				deletedBy: deliverables.deletedBy,
				bookingName: bookings.name,
				bookingReferenceNumber: bookings.referenceNumber,
			})
			.from(deliverables)
			.innerJoin(bookings, eq(deliverables.bookingId, bookings.id))
			.where(
				and(
					eq(deliverables.id, id),
					eq(deliverables.organizationId, context.organizationId),
					isNull(deliverables.deletedAt),
				),
			)
			.limit(1);

		const deliverable = result[0];

		if (!deliverable) {
			throw new ORPCError("NOT_FOUND", {
				message: "Deliverable not found",
			});
		}

		// Get assignments with crew info
		const [assignmentRows, taskLinkRows] = await Promise.all([
			db
				.select({
					id: deliverableAssignments.id,
					deliverableId: deliverableAssignments.deliverableId,
					crewId: deliverableAssignments.crewId,
					isLead: deliverableAssignments.isLead,
					assignedBy: deliverableAssignments.assignedBy,
					progressStatus: deliverableAssignments.progressStatus,
					progressNote: deliverableAssignments.progressNote,
					startedAt: deliverableAssignments.startedAt,
					blockedAt: deliverableAssignments.blockedAt,
					createdAt: deliverableAssignments.createdAt,
					updatedAt: deliverableAssignments.updatedAt,
					crewName: crews.name,
					crewPhone: crews.phoneNumber,
				})
				.from(deliverableAssignments)
				.innerJoin(crews, eq(deliverableAssignments.crewId, crews.id))
				.where(eq(deliverableAssignments.deliverableId, id)),
			db
				.select({
					id: deliverableTaskLinks.id,
					deliverableId: deliverableTaskLinks.deliverableId,
					taskId: deliverableTaskLinks.taskId,
					kind: deliverableTaskLinks.kind,
					createdBy: deliverableTaskLinks.createdBy,
					createdAt: deliverableTaskLinks.createdAt,
					taskName: tasks.name,
					taskWorkflowStatus: tasks.workflowStatus,
					taskDueDate: tasks.dueDate,
				})
				.from(deliverableTaskLinks)
				.innerJoin(tasks, eq(deliverableTaskLinks.taskId, tasks.id))
				.where(
					and(
						eq(deliverableTaskLinks.deliverableId, id),
						isNull(tasks.deletedAt),
					),
				)
				.orderBy(asc(deliverableTaskLinks.createdAt)),
		]);

		const assignments: DeliverableAssignmentWithCrew[] = assignmentRows.map(
			(row) => ({
				id: row.id,
				deliverableId: row.deliverableId,
				crewId: row.crewId,
				isLead: row.isLead,
				assignedBy: row.assignedBy,
				progressStatus: row.progressStatus,
				progressNote: row.progressNote,
				startedAt: row.startedAt?.toISOString() ?? null,
				blockedAt: row.blockedAt?.toISOString() ?? null,
				createdAt: row.createdAt.toISOString(),
				updatedAt: row.updatedAt.toISOString(),
				crew: {
					id: row.crewId,
					name: row.crewName,
					phoneNumber: row.crewPhone,
				},
			}),
		);

		return {
			data: {
				id: deliverable.id,
				organizationId: deliverable.organizationId,
				bookingId: deliverable.bookingId,
				name: deliverable.name,
				description: deliverable.description,
				quantity: deliverable.quantity,
				cost: deliverable.cost,
				isPackageIncluded: deliverable.isPackageIncluded,
				status: deliverable.status,
				workflowStatus: deliverable.workflowStatus,
				trackingMode: deliverable.trackingMode,
				dueDate: deliverable.dueDate,
				completedAt: deliverable.completedAt?.toISOString() ?? null,
				deliveredAt: deliverable.deliveredAt?.toISOString() ?? null,
				metadata: deliverable.metadata as Record<
					string,
					unknown
				> | null,
				createdBy: deliverable.createdBy,
				updatedBy: deliverable.updatedBy,
				createdAt: deliverable.createdAt.toISOString(),
				updatedAt: deliverable.updatedAt.toISOString(),
				deletedAt: deliverable.deletedAt?.toISOString() ?? null,
				deletedBy: deliverable.deletedBy,
				assignments,
				taskLinks: taskLinkRows.map((link) => ({
					id: link.id,
					deliverableId: link.deliverableId,
					taskId: link.taskId,
					kind: link.kind,
					createdBy: link.createdBy,
					createdAt: link.createdAt.toISOString(),
					task: {
						id: link.taskId,
						name: link.taskName,
						workflowStatus: link.taskWorkflowStatus,
						dueDate: link.taskDueDate,
					},
				})),
				booking: {
					id: deliverable.bookingId,
					name: deliverable.bookingName,
					referenceNumber: deliverable.bookingReferenceNumber,
				},
			},
		};
	});
