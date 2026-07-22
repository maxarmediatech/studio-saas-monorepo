import { ORPCError } from "@orpc/server";
import {
	and,
	asc,
	bookings,
	crews,
	db,
	deliverables,
	deliverableTaskLinks,
	eq,
	isNull,
	taskAssignments,
	tasks,
	users,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { hasPermission, requirePermission } from "../../studio/lib/permissions";
import { taskMetadataForDeliverableAccess } from "../../studio/lib/relationship-metadata";
import {
	getTaskInputSchema,
	getTaskOutputSchema,
} from "../../studio/schemas/task";

export const getTask = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/tasks/{id}",
		tags: ["Tasks"],
		summary: "Get task",
		description:
			"Get a single task by ID with assignments and booking info",
	})
	.input(getTaskInputSchema)
	.output(getTaskOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "task", "read");

		const { id } = input;
		const canReadLinkedDeliverables = await hasPermission(
			context,
			"deliverable",
			"read",
		);

		// Get task with organization scope
		const task = await db.query.tasks.findFirst({
			where: and(
				eq(tasks.id, id),
				eq(tasks.organizationId, context.organizationId),
			),
		});

		if (!task) {
			throw new ORPCError("NOT_FOUND", {
				message: "Task not found",
			});
		}

		// Get booking info
		const booking = await db.query.bookings.findFirst({
			where: eq(bookings.id, task.bookingId),
			columns: {
				id: true,
				name: true,
				referenceNumber: true,
			},
		});

		if (!booking) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Booking not found for task",
			});
		}

		// Get assignments with crew info
		const [assignments, deliverableLinkRows] = await Promise.all([
			db
				.select({
					id: taskAssignments.id,
					taskId: taskAssignments.taskId,
					crewId: taskAssignments.crewId,
					assignedBy: taskAssignments.assignedBy,
					assignedByName: users.name,
					progressStatus: taskAssignments.progressStatus,
					progressNote: taskAssignments.progressNote,
					startedAt: taskAssignments.startedAt,
					blockedAt: taskAssignments.blockedAt,
					createdAt: taskAssignments.createdAt,
					updatedAt: taskAssignments.updatedAt,
					crew: {
						id: crews.id,
						name: crews.name,
						phoneNumber: crews.phoneNumber,
					},
				})
				.from(taskAssignments)
				.innerJoin(crews, eq(taskAssignments.crewId, crews.id))
				.leftJoin(users, eq(taskAssignments.assignedBy, users.id))
				.where(eq(taskAssignments.taskId, id)),
			canReadLinkedDeliverables
				? db
						.select({
							id: deliverableTaskLinks.id,
							deliverableId: deliverableTaskLinks.deliverableId,
							kind: deliverableTaskLinks.kind,
							deliverableName: deliverables.name,
							deliverableStatus: deliverables.status,
							deliverableWorkflowStatus:
								deliverables.workflowStatus,
							deliverableMetadata: deliverables.metadata,
						})
						.from(deliverableTaskLinks)
						.innerJoin(
							deliverables,
							eq(
								deliverableTaskLinks.deliverableId,
								deliverables.id,
							),
						)
						.where(
							and(
								eq(deliverableTaskLinks.taskId, id),
								isNull(deliverables.deletedAt),
							),
						)
						.orderBy(asc(deliverableTaskLinks.createdAt))
				: Promise.resolve([]),
		]);

		let metadata = task.metadata as Record<string, unknown> | null;
		const convertedFromDeliverableId =
			typeof metadata?.convertedFromDeliverableId === "string"
				? metadata.convertedFromDeliverableId.trim()
				: null;

		// Backward compatibility for 0047 reference links where conversion metadata
		// exists only on the linked deliverable.
		if (canReadLinkedDeliverables && !convertedFromDeliverableId) {
			const legacyConvertedDeliverable = deliverableLinkRows.find(
				(link) => {
					const linkMetadata = link.deliverableMetadata;
					return (
						linkMetadata !== null &&
						typeof linkMetadata === "object" &&
						!Array.isArray(linkMetadata) &&
						(linkMetadata as Record<string, unknown>)
							.convertedToTaskId === id
					);
				},
			);
			if (legacyConvertedDeliverable) {
				metadata = {
					...(metadata ?? {}),
					convertedFromDeliverableId:
						legacyConvertedDeliverable.deliverableId,
					convertedFromDeliverableName:
						legacyConvertedDeliverable.deliverableName,
				};
			}
		}

		metadata = taskMetadataForDeliverableAccess(
			metadata,
			canReadLinkedDeliverables,
		);

		return {
			data: {
				...task,
				dueDate: task.dueDate ?? null,
				completedAt: task.completedAt?.toISOString() ?? null,
				metadata,
				createdAt: task.createdAt.toISOString(),
				updatedAt: task.updatedAt.toISOString(),
				deletedAt: task.deletedAt?.toISOString() ?? null,
				assignments: assignments.map((a) => ({
					...a,
					startedAt: a.startedAt?.toISOString() ?? null,
					blockedAt: a.blockedAt?.toISOString() ?? null,
					createdAt: a.createdAt.toISOString(),
					updatedAt: a.updatedAt.toISOString(),
				})),
				deliverableLinks: deliverableLinkRows.map((link) => ({
					id: link.id,
					deliverableId: link.deliverableId,
					kind: link.kind,
					deliverable: {
						id: link.deliverableId,
						name: link.deliverableName,
						status: link.deliverableStatus,
						workflowStatus: link.deliverableWorkflowStatus,
					},
				})),
				booking,
			},
		};
	});
