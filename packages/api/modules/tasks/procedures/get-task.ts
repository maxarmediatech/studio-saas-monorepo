import { ORPCError } from "@orpc/server";
import {
	and,
	bookings,
	crews,
	db,
	eq,
	sql,
	taskAssignments,
	tasks,
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
		const assignments = await db
			.select({
				id: taskAssignments.id,
				taskId: taskAssignments.taskId,
				crewId: taskAssignments.crewId,
				assignedBy: taskAssignments.assignedBy,
				createdAt: taskAssignments.createdAt,
				crew: {
					id: crews.id,
					name: crews.name,
					phoneNumber: crews.phoneNumber,
				},
			})
			.from(taskAssignments)
			.innerJoin(crews, eq(taskAssignments.crewId, crews.id))
			.where(eq(taskAssignments.taskId, id));

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
					createdAt: a.createdAt.toISOString(),
				})),
				booking,
			},
		};
	});
