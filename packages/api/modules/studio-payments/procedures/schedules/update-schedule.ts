import { ORPCError } from "@orpc/server";
import { and, db, eq, isNull, paymentSchedules } from "@repo/database";
import { studioProtectedProcedure } from "../../../../orpc/procedures";
import { requirePermission } from "../../../studio/lib/permissions";
import {
	updateScheduleInputSchema,
	updateScheduleOutputSchema,
} from "../../../studio/schemas/payment";

export const updateSchedule = studioProtectedProcedure
	.route({
		method: "PUT",
		path: "/studio-payments/schedules/{id}",
		tags: ["Studio Payments"],
		summary: "Update payment schedule",
		description: "Update an existing payment schedule",
	})
	.input(updateScheduleInputSchema)
	.output(updateScheduleOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "payment", "update");

		const { id, ...updates } = input;

		// Verify schedule exists and belongs to organization
		const schedule = await db.query.paymentSchedules.findFirst({
			where: and(
				eq(paymentSchedules.id, id),
				eq(paymentSchedules.organizationId, context.organizationId),
				isNull(paymentSchedules.deletedAt),
			),
		});

		if (!schedule) {
			throw new ORPCError("NOT_FOUND", {
				message: "Payment schedule not found",
			});
		}

		// Build update object
		const updateData: Record<string, unknown> = {
			updatedAt: new Date(),
			updatedBy: context.user.id,
		};

		if (updates.name !== undefined) {
			updateData.name = updates.name;
		}

		if (updates.amount !== undefined) {
			const newAmount = Number.parseFloat(updates.amount);
			const paidAmount = Number.parseFloat(schedule.paidAmount);

			if (newAmount < paidAmount) {
				throw new ORPCError("CONFLICT", {
					message:
						"Schedule amount cannot be less than amount already paid",
				});
			}

			updateData.amount = updates.amount;

			// Recalculate status based on new amount vs paid amount
			if (paidAmount >= newAmount) {
				updateData.status = "completed";
				if (!schedule.paidAt) {
					updateData.paidAt = new Date();
				}
			} else if (paidAmount > 0) {
				updateData.status = "partial";
			} else {
				updateData.status = "pending";
			}
		}

		if (updates.dueDate !== undefined) {
			updateData.dueDate = updates.dueDate;
		}

		if (updates.notes !== undefined) {
			updateData.notes = updates.notes;
		}

		if (updates.sortOrder !== undefined) {
			updateData.sortOrder = updates.sortOrder;
		}

		// Update schedule
		await db
			.update(paymentSchedules)
			.set(updateData)
			.where(eq(paymentSchedules.id, id));

		return {
			data: { id },
			message: "Payment schedule updated successfully",
		};
	});
