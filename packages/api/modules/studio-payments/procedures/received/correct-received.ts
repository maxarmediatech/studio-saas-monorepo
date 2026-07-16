import { db } from "@repo/database";
import { studioProtectedProcedure } from "../../../../orpc/procedures";
import { requirePermission } from "../../../studio/lib/permissions";
import {
	correctReceivedInputSchema,
	correctReceivedOutputSchema,
} from "../../../studio/schemas/payment";
import { correctReceivedPaymentIdempotently } from "../../lib/payment-idempotency";

export const correctReceived = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/studio-payments/received/{id}/correct",
		tags: ["Studio Payments"],
		summary: "Correct a received payment",
		description:
			"Reverse a finalized payment and atomically create its audited replacement",
	})
	.input(correctReceivedInputSchema)
	.output(correctReceivedOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "payment", "update");

		const execution = await db.transaction((tx) =>
			correctReceivedPaymentIdempotently(tx, {
				...input,
				actorName: context.user.name || "Unknown User",
				organizationId: context.organizationId,
				userId: context.user.id,
			}),
		);

		return execution.result;
	});
