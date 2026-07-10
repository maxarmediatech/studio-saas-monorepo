import { ORPCError } from "@orpc/server";
import { and, db, eq, isNull, paymentSchedules } from "@repo/database";
import { studioProtectedProcedure } from "../../../../orpc/procedures";
import { formatAmount, safeTrackActivity } from "../../../activities/lib";
import {
	getLockedBookingForReceipt,
	getLockedScheduleForReceipt,
} from "../../../receipts/lib/locked-invoice-for-receipt";
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
		await requirePermission(context, "payment", "delete");

		const { id } = input;

		const lockPlan = await db.query.paymentSchedules.findFirst({
			where: and(
				eq(paymentSchedules.id, id),
				eq(paymentSchedules.organizationId, context.organizationId),
				isNull(paymentSchedules.deletedAt),
			),
		});

		if (!lockPlan) {
			throw new ORPCError("NOT_FOUND", {
				message: "Payment schedule not found",
			});
		}

		const { bookingName, schedule } = await db.transaction(async (tx) => {
			const booking = await getLockedBookingForReceipt(tx, {
				organizationId: context.organizationId,
				bookingId: lockPlan.bookingId,
			});
			if (!booking) {
				throw new ORPCError("NOT_FOUND", {
					message: "Booking not found",
				});
			}
			const schedule = await getLockedScheduleForReceipt(tx, {
				organizationId: context.organizationId,
				bookingId: lockPlan.bookingId,
				paymentScheduleId: id,
			});
			if (!schedule) {
				throw new ORPCError("NOT_FOUND", {
					message: "Payment schedule not found",
				});
			}
			if (
				schedule.status === "partial" ||
				schedule.status === "completed" ||
				schedule.status === "cancelled"
			) {
				throw new ORPCError("CONFLICT", {
					message:
						"Partially paid, completed, or cancelled schedules cannot be deleted",
				});
			}
			await tx
				.update(paymentSchedules)
				.set({
					deletedAt: new Date(),
					deletedBy: context.user.id,
					updatedAt: new Date(),
					updatedBy: context.user.id,
				})
				.where(eq(paymentSchedules.id, id));
			return { bookingName: booking.name, schedule };
		});

		// Track activity (non-blocking)
		await safeTrackActivity(context, {
			entityType: "payment_schedule",
			entityId: id,
			entityName: `${schedule.name} (${formatAmount(schedule.amount)})`,
			action: "deleted",
			parentEntityType: "booking",
			parentEntityId: schedule.bookingId,
			parentEntityName: bookingName,
		});

		return {
			data: { id },
			message: "Payment schedule deleted successfully",
		};
	});
