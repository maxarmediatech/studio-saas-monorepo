import { db } from "@repo/database";
import { studioProtectedProcedure } from "../../../../orpc/procedures";
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
				actorName: context.user.name || "Unknown User",
				organizationId: context.organizationId,
				userId: context.user.id,
			}),
		);

		return execution.result;
	});
