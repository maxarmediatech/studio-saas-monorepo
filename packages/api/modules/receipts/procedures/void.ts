import { ORPCError } from "@orpc/server";
import { and, db, eq, receipts } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { formatAmount, safeTrackActivity } from "../../activities/lib";
import { requirePermission } from "../../studio/lib/permissions";
import {
	voidReceiptInputSchema,
	voidReceiptOutputSchema,
} from "../../studio/schemas/receipt";
import {
	getLockedBookingForReceipt,
	getLockedInvoiceForReceipt,
	getLockedReceiptForVoid,
} from "../lib/locked-invoice-for-receipt";
import { updateInvoicePaymentStatus } from "../lib/receipt-helpers";
import { getLockedReceivedPayment } from "../../studio-payments/lib/received-payment-lock";

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

		const result = await db.transaction(async (tx) => {
			// Only discover IDs here. All rows participating in the transition are
			// re-read after locks: booking -> invoice -> received payment -> receipt.
			const lockPlan = await tx.query.receipts.findFirst({
				where: and(
					eq(receipts.id, id),
					eq(receipts.organizationId, context.organizationId),
				),
			});

			if (!lockPlan) {
				throw new ORPCError("NOT_FOUND", {
					message: "Receipt not found",
				});
			}

			if (lockPlan.deletedAt) {
				return { receipt: lockPlan, bookingName: "Unknown Booking", voided: false };
			}

			const booking = await getLockedBookingForReceipt(tx, {
				organizationId: context.organizationId,
				bookingId: lockPlan.bookingId,
			});

			if (!booking) {
				throw new ORPCError("NOT_FOUND", { message: "Booking not found" });
			}

			if (lockPlan.invoiceId) {
				const invoice = await getLockedInvoiceForReceipt(tx, {
					organizationId: context.organizationId,
					bookingId: lockPlan.bookingId,
					invoiceId: lockPlan.invoiceId,
					allowCancelled: true,
				});
				if (!invoice) {
					throw new ORPCError("NOT_FOUND", {
						message: "Invoice not found or does not belong to this booking",
					});
				}
			}

			if (lockPlan.receivedAmountId) {
				const received = await getLockedReceivedPayment(tx, {
					organizationId: context.organizationId,
					receivedAmountId: lockPlan.receivedAmountId,
				});
				if (!received) {
					throw new ORPCError("CONFLICT", {
						message: "Receipt payment no longer exists",
					});
				}
				if (
					received.bookingId !== lockPlan.bookingId ||
					received.invoiceId !== lockPlan.invoiceId
				) {
					throw new ORPCError("CONFLICT", {
						message: "Receipt payment relationships changed. Retry the request.",
					});
				}
			}

			const receipt = await getLockedReceiptForVoid(tx, {
				organizationId: context.organizationId,
				receiptId: id,
			});

			if (!receipt) {
				return { receipt: lockPlan, bookingName: booking.name, voided: false };
			}

			if (
				receipt.bookingId !== lockPlan.bookingId ||
				receipt.invoiceId !== lockPlan.invoiceId ||
				receipt.receivedAmountId !== lockPlan.receivedAmountId
			) {
				throw new ORPCError("CONFLICT", {
					message: "Receipt relationships changed. Retry the request.",
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

			await tx.update(receipts).set(updateData).where(eq(receipts.id, id));

			if (receipt.invoiceId) {
				await updateInvoicePaymentStatus(tx, receipt.invoiceId, context.user.id, {
					allowCancelled: true,
				});
			}

			return {
				receipt,
				bookingName: booking.name,
				voided: true,
			};
		});

		if (!result.voided) {
			return {
				data: { id },
				message: "Receipt already voided",
			};
		}

		await safeTrackActivity(context, {
			entityType: "received_amount",
			entityId: id,
			entityName: `Receipt ${result.receipt.receiptNumber} (${formatAmount(result.receipt.amount)})`,
			action: "deleted",
			parentEntityType: "booking",
			parentEntityId: result.receipt.bookingId,
			parentEntityName: result.bookingName,
			metadata: reason
				? { reason, type: "receipt_voided" }
				: { type: "receipt_voided" },
		});

		return {
			data: { id },
			message: "Receipt voided successfully",
		};
	});
