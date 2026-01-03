import { ORPCError } from "@orpc/server";
import { and, bookings, db, deliverables, eq, isNull } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	createDeliverableInputSchema,
	createDeliverableOutputSchema,
} from "../../studio/schemas/deliverable";

export const createDeliverable = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/deliverables",
		tags: ["Deliverables"],
		summary: "Create deliverable",
		description: "Create a new deliverable for a booking",
	})
	.input(createDeliverableInputSchema)
	.output(createDeliverableOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "deliverable", "create");

		const {
			bookingId,
			name,
			description,
			deliverableType,
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

		// Create deliverable
		const [created] = await db
			.insert(deliverables)
			.values({
				organizationId: context.organizationId,
				bookingId,
				name,
				description: description ?? null,
				deliverableType,
				status: status ?? "pending",
				priority: priority ?? "normal",
				workflowStatus: "not_started",
				dueDate: dueDate ?? null,
				metadata: metadata ?? null,
				createdBy: context.user.id,
				updatedBy: context.user.id,
			})
			.returning({ id: deliverables.id });

		if (!created) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create deliverable",
			});
		}

		return {
			data: { id: created.id },
			message: "Deliverable created successfully",
		};
	});
