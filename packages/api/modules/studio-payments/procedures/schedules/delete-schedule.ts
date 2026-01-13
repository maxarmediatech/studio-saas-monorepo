import { ORPCError } from "@orpc/server";
import { and, bookings, db, eq, isNull, paymentSchedules } from "@repo/database";
import { studioProtectedProcedure } from "../../../../orpc/procedures";
import { formatAmount, safeTrackActivity } from "../../../activities/lib";
import { requirePermission } from "../../../studio/lib/permissions";
import {
	deleteScheduleInputSchema,
	deleteScheduleOutputSchema,
} from "../../../studio/schemas/payment";

export const deleteSchedule = studioProtectedProcedure
	.route({
		method: "DELETE",
		path: "/studio-payments/schedules/{id}",
		tags: ["Studio Payments"],
		summary: "Delete payment schedule",
		description: "Soft delete a payment schedule",
	})
	.input(deleteScheduleInputSchema)
	.output(deleteScheduleOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "payment", "delete");

		const { id } = input;

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

		// Fetch booking for activity context
		const booking = await db.query.bookings.findFirst({
			where: eq(bookings.id, schedule.bookingId),
			columns: { name: true },
		});

		// Soft delete
		await db
			.update(paymentSchedules)
			.set({
				deletedAt: new Date(),
				deletedBy: context.user.id,
				updatedAt: new Date(),
				updatedBy: context.user.id,
			})
			.where(eq(paymentSchedules.id, id));

		// Track activity (non-blocking)
		await safeTrackActivity(context, {
			entityType: "payment_schedule",
			entityId: id,
			entityName: `${schedule.name} (${formatAmount(schedule.amount)})`,
			action: "deleted",
			parentEntityType: "booking",
			parentEntityId: schedule.bookingId,
			parentEntityName: booking?.name ?? "Unknown Booking",
		});

		return {
			data: { id },
			message: "Payment schedule deleted successfully",
		};
	});
