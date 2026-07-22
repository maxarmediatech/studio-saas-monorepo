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
	sql,
	taskAssignments,
	tasks,
	users,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
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
			db
				.select({
					id: deliverableTaskLinks.id,
					deliverableId: deliverableTaskLinks.deliverableId,
					kind: deliverableTaskLinks.kind,
					deliverableName: deliverables.name,
					deliverableWorkflowStatus: deliverables.workflowStatus,
				})
				.from(deliverableTaskLinks)
				.innerJoin(
					deliverables,
					eq(deliverableTaskLinks.deliverableId, deliverables.id),
				)
				.where(
					and(
						eq(deliverableTaskLinks.taskId, id),
						isNull(deliverables.deletedAt),
					),
				)
				.orderBy(asc(deliverableTaskLinks.createdAt)),
		]);

		let metadata = task.metadata as Record<string, unknown> | null;
		const convertedFromDeliverableId =
			typeof metadata?.convertedFromDeliverableId === "string"
				? metadata.convertedFromDeliverableId.trim()
				: null;

		// Backward compatibility for older converted tasks where metadata was not
		// written on task records.
		if (!convertedFromDeliverableId) {
			const legacyConversionResult = await db.execute(sql`
				SELECT d.id, d.name
				FROM deliverables d
				WHERE
					d.organization_id = ${context.organizationId}
					AND d.deleted_at IS NULL
					AND d.metadata ->> 'convertedToTaskId' = ${id}
				LIMIT 1
			`);

			const linkedDeliverable = legacyConversionResult.rows[0] as
				| { id: string; name: string }
				| undefined;

			if (linkedDeliverable) {
				metadata = {
					...(metadata ?? {}),
					convertedFromDeliverableId: linkedDeliverable.id,
					convertedFromDeliverableName: linkedDeliverable.name,
				};
			}
		}

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
						workflowStatus: link.deliverableWorkflowStatus,
					},
				})),
				booking,
			},
		};
	});
