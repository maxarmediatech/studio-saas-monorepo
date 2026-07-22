import { ORPCError } from "@orpc/server";
import {
	assignmentSubmissions,
	db,
	deliverableAssignments,
	deliverables,
	deliverableTaskLinks,
	eq,
	sql,
	taskAssignments,
	tasks,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { safeTrackActivity } from "../../activities/lib";
import { safeAutoSubscribe } from "../../notifications/lib/notification-service";
import { requirePermission } from "../../studio/lib/permissions";
import {
	convertDeliverableToTaskInputSchema,
	convertDeliverableToTaskOutputSchema,
} from "../../studio/schemas/deliverable";
import {
	buildConvertedDeliverableMetadata,
	deriveConvertedTaskWorkflowStatus,
	getConvertedTaskIdFromMetadata,
} from "../lib/convert-to-task";
import { recomputeTaskBasedDeliverable } from "../lib/task-rollup";

export const convertDeliverableToTask = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/deliverables/{deliverableId}/convert-to-task",
		tags: ["Deliverables"],
		summary: "Convert deliverable to task",
		description:
			"Create a task from a deliverable, optionally copying assignments",
	})
	.input(convertDeliverableToTaskInputSchema)
	.output(convertDeliverableToTaskOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "deliverable", "update");
		await requirePermission(context, "task", "create");

		const {
			deliverableId,
			taskName,
			taskDescription,
			taskPriority,
			taskDueDate,
		} = input;

		// Use transaction for atomicity
		const converted = await db.transaction(async (tx) => {
			// Lock deliverable row so concurrent conversion requests serialize.
			const result = await tx.execute(sql`
				SELECT
					d.id,
					d.booking_id AS "bookingId",
					d.name,
					d.description,
					d.due_date AS "dueDate",
					d.tracking_mode AS "trackingMode",
					d.metadata,
					b.name AS "bookingName"
				FROM deliverables d
				INNER JOIN bookings b ON b.id = d.booking_id
				WHERE
					d.id = ${deliverableId}
					AND d.organization_id = ${context.organizationId}
					AND d.deleted_at IS NULL
				FOR UPDATE
			`);

			const lockedDeliverable = result.rows[0] as
				| {
						id: string;
						bookingId: string;
						name: string;
						description: string | null;
						dueDate: string | null;
						trackingMode: "direct" | "task_based";
						metadata: unknown;
						bookingName: string;
				  }
				| undefined;

			if (!lockedDeliverable) {
				throw new ORPCError("NOT_FOUND", {
					message: "Deliverable not found",
				});
			}

			const existingTaskId = getConvertedTaskIdFromMetadata(
				lockedDeliverable.metadata,
			);
			if (
				existingTaskId ||
				lockedDeliverable.trackingMode === "task_based"
			) {
				throw new ORPCError("CONFLICT", {
					message: existingTaskId
						? `Deliverable already converted to task (${existingTaskId})`
						: "Deliverable already uses task-based tracking",
				});
			}
			const existingSubmission =
				await tx.query.assignmentSubmissions.findFirst({
					where: eq(
						assignmentSubmissions.deliverableId,
						deliverableId,
					),
					columns: { id: true },
				});
			if (existingSubmission) {
				throw new ORPCError("CONFLICT", {
					message:
						"A deliverable with direct submissions cannot be converted to task-based tracking",
				});
			}

			const finalTaskName = taskName ?? `Task: ${lockedDeliverable.name}`;
			const finalTaskDescription =
				taskDescription ?? lockedDeliverable.description ?? null;
			const finalTaskDueDate =
				taskDueDate ?? lockedDeliverable.dueDate ?? null;
			const convertedAtIso = new Date().toISOString();

			// Create the task
			const [createdTask] = await tx
				.insert(tasks)
				.values({
					organizationId: context.organizationId,
					bookingId: lockedDeliverable.bookingId,
					name: finalTaskName,
					description: finalTaskDescription,
					status: "pending",
					priority: taskPriority ?? "normal",
					workflowStatus: "not_started",
					dueDate: finalTaskDueDate,
					metadata: {
						convertedFromDeliverableId: deliverableId,
						convertedFromDeliverableName: lockedDeliverable.name,
					},
					createdBy: context.user.id,
					updatedBy: context.user.id,
				})
				.returning({ id: tasks.id });

			if (!createdTask) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Failed to create task",
				});
			}

			// Copy assignments from deliverable to task
			const existingAssignments = await tx
				.select({
					crewId: deliverableAssignments.crewId,
					progressStatus: deliverableAssignments.progressStatus,
					progressNote: deliverableAssignments.progressNote,
					startedAt: deliverableAssignments.startedAt,
					blockedAt: deliverableAssignments.blockedAt,
				})
				.from(deliverableAssignments)
				.where(eq(deliverableAssignments.deliverableId, deliverableId));

			if (existingAssignments.length > 0) {
				await tx.insert(taskAssignments).values(
					existingAssignments.map((assignment) => ({
						taskId: createdTask.id,
						crewId: assignment.crewId,
						progressStatus: assignment.progressStatus,
						progressNote: assignment.progressNote,
						startedAt: assignment.startedAt,
						blockedAt: assignment.blockedAt,
						assignedBy: context.user.id,
					})),
				);

				// Update task workflow status since it has assignments
				await tx
					.update(tasks)
					.set({
						workflowStatus: deriveConvertedTaskWorkflowStatus(
							existingAssignments.map(
								(assignment) => assignment.progressStatus,
							),
						),
						updatedAt: new Date(),
						updatedBy: context.user.id,
					})
					.where(eq(tasks.id, createdTask.id));
				await tx
					.delete(deliverableAssignments)
					.where(
						eq(deliverableAssignments.deliverableId, deliverableId),
					);
			}

			await tx.insert(deliverableTaskLinks).values({
				organizationId: context.organizationId,
				bookingId: lockedDeliverable.bookingId,
				deliverableId,
				taskId: createdTask.id,
				kind: "required",
				createdBy: context.user.id,
			});

			// Update deliverable metadata to track conversion
			await tx
				.update(deliverables)
				.set({
					trackingMode: "task_based",
					metadata: buildConvertedDeliverableMetadata(
						lockedDeliverable.metadata,
						createdTask.id,
						convertedAtIso,
					),
					updatedAt: new Date(),
					updatedBy: context.user.id,
				})
				.where(eq(deliverables.id, deliverableId));
			await recomputeTaskBasedDeliverable(
				tx,
				context,
				deliverableId,
				new Date(),
			);

			return {
				taskId: createdTask.id,
				taskName: finalTaskName,
				deliverableName: lockedDeliverable.name,
				bookingId: lockedDeliverable.bookingId,
				bookingName: lockedDeliverable.bookingName,
			};
		});

		// Track activity (non-blocking)
		await safeTrackActivity(
			{ organizationId: context.organizationId, user: context.user },
			{
				entityType: "task",
				entityId: converted.taskId,
				entityName: converted.taskName,
				action: "created",
				parentEntityType: "booking",
				parentEntityId: converted.bookingId,
				parentEntityName: converted.bookingName,
				metadata: {
					priority: taskPriority ?? "normal",
					convertedFromDeliverableId: deliverableId,
				},
			},
		);

		await safeTrackActivity(
			{ organizationId: context.organizationId, user: context.user },
			{
				entityType: "deliverable",
				entityId: deliverableId,
				entityName: converted.deliverableName,
				action: "converted_to_task",
				parentEntityType: "booking",
				parentEntityId: converted.bookingId,
				parentEntityName: converted.bookingName,
				metadata: {
					convertedToTaskId: converted.taskId,
				},
			},
		);

		await safeAutoSubscribe({
			organizationId: context.organizationId,
			userId: context.user.id,
			entityType: "task",
			entityId: converted.taskId,
		});

		return {
			data: {
				taskId: converted.taskId,
				deliverableId: deliverableId,
			},
			message: "Deliverable converted to task successfully",
		};
	});
