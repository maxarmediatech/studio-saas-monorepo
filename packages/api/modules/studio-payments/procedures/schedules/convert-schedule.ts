import { db } from "@repo/database";
import { studioProtectedProcedure } from "../../../../orpc/procedures";
import { formatAmount, safeTrackActivity } from "../../../activities/lib";
import { requirePermission } from "../../../studio/lib/permissions";
import {
	convertScheduleInputSchema,
	convertScheduleOutputSchema,
} from "../../../studio/schemas/payment";
import { convertSchedulePaymentIdempotently } from "../../lib/payment-idempotency";

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

		const execution = await db.transaction((tx) =>
			convertSchedulePaymentIdempotently(tx, {
				...input,
				organizationId: context.organizationId,
				userId: context.user.id,
			}),
		);

		if (!execution.replayed) {
			const { activity, result } = execution;
			await safeTrackActivity(context, {
				entityType: "payment_schedule",
				entityId: input.scheduleId,
				entityName: `${activity.schedule.name} (${formatAmount(activity.schedule.amount)})`,
				action: "marked_paid",
				parentEntityType: "booking",
				parentEntityId: activity.schedule.bookingId,
				parentEntityName: activity.bookingName,
				metadata: {
					paidAmount: input.amount,
					totalPaidAmount: activity.paidAmount,
					scheduleStatus: activity.scheduleStatus,
					receivedId: result.receivedId,
					receiptId: result.receiptId,
				},
			});
		}

		return {
			data: execution.result,
			message: "Payment schedule converted successfully",
		};
	});
