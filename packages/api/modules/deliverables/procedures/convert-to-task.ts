import { ORPCError } from "@orpc/server";
import {
	and,
	db,
	deliverableAssignments,
	deliverables,
	eq,
	isNull,
	taskAssignments,
	tasks,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	convertDeliverableToTaskInputSchema,
	convertDeliverableToTaskOutputSchema,
} from "../../studio/schemas/deliverable";

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
		requirePermission(context, "deliverable", "update");
		requirePermission(context, "task", "create");

		const {
			deliverableId,
			taskName,
			taskDescription,
			taskPriority,
			taskDueDate,
		} = input;

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

		// Use transaction for atomicity
		return await db.transaction(async (tx) => {
			// Create the task
			const [createdTask] = await tx
				.insert(tasks)
				.values({
					organizationId: context.organizationId,
					bookingId: deliverable.bookingId,
					name: taskName ?? `Task: ${deliverable.name}`,
					description:
						taskDescription ?? deliverable.description ?? null,
					status: "pending",
					priority: taskPriority ?? "normal",
					workflowStatus: "not_started",
					dueDate: taskDueDate ?? deliverable.dueDate ?? null,
					metadata: {
						convertedFromDeliverableId: deliverableId,
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
				})
				.from(deliverableAssignments)
				.where(eq(deliverableAssignments.deliverableId, deliverableId));

			if (existingAssignments.length > 0) {
				await tx.insert(taskAssignments).values(
					existingAssignments.map((assignment) => ({
						taskId: createdTask.id,
						crewId: assignment.crewId,
						assignedBy: context.user.id,
					})),
				);

				// Update task workflow status since it has assignments
				await tx
					.update(tasks)
					.set({
						workflowStatus: "assigned",
						updatedAt: new Date(),
						updatedBy: context.user.id,
					})
					.where(eq(tasks.id, createdTask.id));
			}

			// Update deliverable metadata to track conversion
			await tx
				.update(deliverables)
				.set({
					metadata: {
						...((deliverable.metadata as Record<string, unknown>) ??
							{}),
						convertedToTaskId: createdTask.id,
						convertedAt: new Date().toISOString(),
					},
					updatedAt: new Date(),
					updatedBy: context.user.id,
				})
				.where(eq(deliverables.id, deliverableId));

			return {
				data: {
					taskId: createdTask.id,
					deliverableId: deliverableId,
				},
				message: "Deliverable converted to task successfully",
			};
		});
	});
