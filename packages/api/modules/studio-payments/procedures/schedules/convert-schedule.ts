import { db } from "@repo/database";
import { studioProtectedProcedure } from "../../../../orpc/procedures";
import { formatAmount, safeTrackActivity } from "../../../activities/lib";
import { requirePermission } from "../../../studio/lib/permissions";
import {
	convertScheduleInputSchema,
	convertScheduleOutputSchema,
} from "../../../studio/schemas/payment";
import { convertSchedulePaymentTransition } from "../../lib/schedule-payment-service";

export const convertSchedule = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/studio-payments/schedules/{scheduleId}/convert",
		tags: ["Studio Payments"],
		summary: "Convert schedule to received",
		description:
			"Mark a payment schedule as paid by creating a received payment record",
	})
	.input(convertScheduleInputSchema)
	.output(convertScheduleOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "payment", "create");

		const result = await db.transaction((tx) =>
			convertSchedulePaymentTransition(tx, {
				...input,
				organizationId: context.organizationId,
				userId: context.user.id,
			}),
		);

		await safeTrackActivity(context, {
			entityType: "payment_schedule",
			entityId: input.scheduleId,
			entityName: `${result.schedule.name} (${formatAmount(result.schedule.amount)})`,
			action: "marked_paid",
			parentEntityType: "booking",
			parentEntityId: result.schedule.bookingId,
			parentEntityName: result.bookingName,
			metadata: {
				paidAmount: input.amount,
				totalPaidAmount: result.paidAmount,
				scheduleStatus: result.scheduleStatus,
				receivedId: result.receivedId,
				receiptId: result.receiptId,
			},
		});

		return {
			data: {
				receivedId: result.receivedId,
				scheduleId: result.scheduleId,
				receiptId: result.receiptId,
			},
			message: "Payment schedule converted successfully",
		};
	});
