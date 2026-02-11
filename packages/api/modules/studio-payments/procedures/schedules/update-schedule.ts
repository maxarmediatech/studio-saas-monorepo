import { ORPCError } from "@orpc/server";
import { and, bookings, db, eq, isNull, paymentSchedules } from "@repo/database";
import { studioProtectedProcedure } from "../../../../orpc/procedures";
import {
	detectChanges,
	formatAmount,
	formatDate,
	safeTrackFieldChanges,
	safeTrackStatusChange,
} from "../../../activities/lib";
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
		await requirePermission(context, "payment", "update");

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

		if (schedule.status === "completed" || schedule.status === "cancelled") {
			throw new ORPCError("CONFLICT", {
				message: "Completed or cancelled schedules cannot be modified",
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

		// Fetch booking for activity context
		const booking = await db.query.bookings.findFirst({
			where: eq(bookings.id, schedule.bookingId),
			columns: { name: true },
		});

		const entityName = `${updates.name ?? schedule.name} (${formatAmount(updates.amount ?? schedule.amount)})`;

		// Track status change if it occurred (non-blocking)
		if (updateData.status && updateData.status !== schedule.status) {
			await safeTrackStatusChange(context, {
				entityType: "payment_schedule",
				entityId: id,
				entityName,
				oldStatus: schedule.status,
				newStatus: updateData.status as string,
				parentEntityType: "booking",
				parentEntityId: schedule.bookingId,
				parentEntityName: booking?.name ?? "Unknown Booking",
			});
		}

		// Track field changes (non-blocking)
		const changes = detectChanges(
			{
				name: schedule.name,
				amount: schedule.amount,
				dueDate: schedule.dueDate,
				notes: schedule.notes,
			},
			{
				name: updates.name,
				amount: updates.amount,
				dueDate: updates.dueDate,
				notes: updates.notes,
			},
			["name", "amount", "dueDate", "notes"],
		).map((c) => ({
			...c,
			// Format values for display
			oldValue:
				c.field === "amount" && c.oldValue
					? formatAmount(c.oldValue)
					: c.field === "dueDate" && c.oldValue
						? formatDate(c.oldValue)
						: c.oldValue,
			newValue:
				c.field === "amount" && c.newValue
					? formatAmount(c.newValue)
					: c.field === "dueDate" && c.newValue
						? formatDate(c.newValue)
						: c.newValue,
		}));

		if (changes.length > 0) {
			await safeTrackFieldChanges(context, {
				entityType: "payment_schedule",
				entityId: id,
				entityName,
				parentEntityType: "booking",
				parentEntityId: schedule.bookingId,
				parentEntityName: booking?.name ?? "Unknown Booking",
				changes,
			});
		}

		return {
			data: { id },
			message: "Payment schedule updated successfully",
		};
	});
