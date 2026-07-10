import { db } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { formatAmount, safeTrackActivity } from "../../activities/lib";
import { requirePermission } from "../../studio/lib/permissions";
import {
	voidReceiptInputSchema,
	voidReceiptOutputSchema,
} from "../../studio/schemas/receipt";
import { voidReceiptTransition } from "../lib/receipt-transition-service";

export const voidReceipt = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/receipts/{id}/void",
		tags: ["Receipts"],
		summary: "Void receipt",
		description: "Void a receipt (soft delete) - receipts cannot be edited",
	})
	.input(voidReceiptInputSchema)
	.output(voidReceiptOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "payment", "delete");

		const result = await db.transaction((tx) =>
			voidReceiptTransition(tx, {
				organizationId: context.organizationId,
				userId: context.user.id,
				receiptId: input.id,
				reason: input.reason,
			}),
		);

		if (!result.voided) {
			return {
				data: { id: input.id },
				message: "Receipt already voided",
			};
		}

		await safeTrackActivity(context, {
			entityType: "received_amount",
			entityId: input.id,
			entityName: `Receipt ${result.receipt.receiptNumber} (${formatAmount(result.receipt.amount)})`,
			action: "deleted",
			parentEntityType: "booking",
			parentEntityId: result.receipt.bookingId,
			parentEntityName: result.bookingName,
			metadata: input.reason
				? { reason: input.reason, type: "receipt_voided" }
				: { type: "receipt_voided" },
		});

		return {
			data: { id: input.id },
			message: "Receipt voided successfully",
		};
	});
