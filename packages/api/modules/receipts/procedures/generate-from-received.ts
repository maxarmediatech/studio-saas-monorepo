import { db } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { formatAmount, safeTrackActivity } from "../../activities/lib";
import { requirePermission } from "../../studio/lib/permissions";
import {
	generateReceiptFromReceivedInputSchema,
	generateReceiptFromReceivedOutputSchema,
} from "../../studio/schemas/receipt";
import { issueReceiptForReceivedPayment } from "../lib/receipt-transition-service";

export const generateReceiptFromReceived = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/receipts/from-received",
		tags: ["Receipts"],
		summary: "Generate receipt from received payment",
		description:
			"Generate a receipt from an existing received payment with or without an invoice",
	})
	.input(generateReceiptFromReceivedInputSchema)
	.output(generateReceiptFromReceivedOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "payment", "create");

		const result = await db.transaction((tx) =>
			issueReceiptForReceivedPayment(tx, {
				organizationId: context.organizationId,
				userId: context.user.id,
				receivedAmountId: input.receivedAmountId,
			}),
		);

		if (result.created) {
			await safeTrackActivity(context, {
				entityType: "receipt",
				entityId: result.id,
				entityName: `Receipt ${result.receiptNumber} (${formatAmount(result.received.amount)})`,
				action: "created",
				parentEntityType: "booking",
				parentEntityId: result.received.bookingId,
				parentEntityName: result.booking.name,
				metadata: {
					receiptNumber: result.receiptNumber,
					amount: result.received.amount,
					type: "receipt",
					source: "manual_from_payment",
					receivedAmountId: result.received.id,
					invoiceId: result.received.invoiceId,
				},
			});
		}

		return {
			data: { id: result.id },
			message: result.created
				? "Receipt generated successfully"
				: "Receipt already exists",
		};
	});
