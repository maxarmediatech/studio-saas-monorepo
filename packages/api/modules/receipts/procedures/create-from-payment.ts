import { db } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { formatAmount, safeTrackActivity } from "../../activities/lib";
import { requirePermission } from "../../studio/lib/permissions";
import {
	createReceiptFromPaymentInputSchema,
	createReceiptFromPaymentOutputSchema,
} from "../../studio/schemas/receipt";
import { issueReceiptForReceivedPayment } from "../lib/receipt-transition-service";

export const createReceiptFromPayment = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/receipts/from-payment",
		tags: ["Receipts"],
		summary: "Create receipt from payment",
		description:
			"Auto-generate a receipt when a payment is linked to an invoice",
	})
	.input(createReceiptFromPaymentInputSchema)
	.output(createReceiptFromPaymentOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "payment", "create");

		const result = await db.transaction((tx) =>
			issueReceiptForReceivedPayment(tx, {
				organizationId: context.organizationId,
				userId: context.user.id,
				receivedAmountId: input.receivedAmountId,
				expectedBookingId: input.bookingId,
				expectedInvoiceId: input.invoiceId,
			}),
		);

		if (result.created) {
			await safeTrackActivity(context, {
				entityType: "received_amount",
				entityId: result.id,
				entityName: `Receipt ${result.receiptNumber} (${formatAmount(result.received.amount)})`,
				action: "created",
				parentEntityType: "booking",
				parentEntityId: input.bookingId,
				parentEntityName: result.booking.name,
				metadata: {
					receiptNumber: result.receiptNumber,
					amount: result.received.amount,
					invoiceNumber: result.invoice?.invoiceNumber,
					type: "receipt",
				},
			});
		}

		return {
			data: { id: result.id },
			message: result.created
				? "Receipt created successfully"
				: "Receipt already exists",
		};
	});
