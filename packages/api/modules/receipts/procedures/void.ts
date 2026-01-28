import { ORPCError } from "@orpc/server";
import { and, bookings, db, eq, isNull, receipts } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { formatAmount, safeTrackActivity } from "../../activities/lib";
import { requirePermission } from "../../studio/lib/permissions";
import {
	voidReceiptInputSchema,
	voidReceiptOutputSchema,
} from "../../studio/schemas/receipt";
import { updateInvoicePaymentStatus } from "../lib/receipt-helpers";

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

		const { id, reason } = input;

		const receipt = await db.query.receipts.findFirst({
			where: and(
				eq(receipts.id, id),
				eq(receipts.organizationId, context.organizationId),
				isNull(receipts.deletedAt),
			),
		});

		if (!receipt) {
			throw new ORPCError("NOT_FOUND", {
				message: "Receipt not found",
			});
		}

		const updateData: Record<string, unknown> = {
			deletedAt: new Date(),
			deletedBy: context.user.id,
			updatedAt: new Date(),
			updatedBy: context.user.id,
		};

		if (reason) {
			const existingNotes = receipt.notes ?? "";
			const voidNote = `[Voided: ${reason}]`;
			updateData.notes = existingNotes
				? `${existingNotes}\n\n${voidNote}`
				: voidNote;
		}

		await db.update(receipts).set(updateData).where(eq(receipts.id, id));

		if (receipt.invoiceId) {
			await updateInvoicePaymentStatus(
				receipt.invoiceId,
				context.user.id,
			);
		}

		const booking = await db.query.bookings.findFirst({
			where: eq(bookings.id, receipt.bookingId),
			columns: { name: true },
		});

		await safeTrackActivity(context, {
			entityType: "received_amount",
			entityId: id,
			entityName: `Receipt ${receipt.receiptNumber} (${formatAmount(receipt.amount)})`,
			action: "deleted",
			parentEntityType: "booking",
			parentEntityId: receipt.bookingId,
			parentEntityName: booking?.name ?? "Unknown Booking",
			metadata: reason
				? { reason, type: "receipt_voided" }
				: { type: "receipt_voided" },
		});

		return {
			data: { id },
			message: "Receipt voided successfully",
		};
	});
