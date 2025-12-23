import { ORPCError } from "@orpc/server";
import { and, eq, isNull, tasks, bookings, db } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	createTaskInputSchema,
	createTaskOutputSchema,
} from "../../studio/schemas/task";

export const createTask = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/tasks",
		tags: ["Tasks"],
		summary: "Create task",
		description: "Create a new task for a booking",
	})
	.input(createTaskInputSchema)
	.output(createTaskOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "task", "create");

		const {
			bookingId,
			name,
			description,
			status,
			priority,
			dueDate,
			metadata,
		} = input;

		// Verify booking exists and belongs to organization
		const booking = await db.query.bookings.findFirst({
			where: and(
				eq(bookings.id, bookingId),
				eq(bookings.organizationId, context.organizationId),
				isNull(bookings.deletedAt),
			),
		});

		if (!booking) {
			throw new ORPCError("NOT_FOUND", {
				message: "Booking not found",
			});
		}

		// Create task
		const [created] = await db
			.insert(tasks)
			.values({
				organizationId: context.organizationId,
				bookingId,
				name,
				description: description ?? null,
				status: status ?? "pending",
				priority: priority ?? "normal",
				dueDate: dueDate ?? null,
				metadata: metadata ?? null,
				createdBy: context.user.id,
			})
			.returning({ id: tasks.id });

		if (!created) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create task",
			});
		}

		return {
			data: { id: created.id },
			message: "Task created successfully",
		};
	});
