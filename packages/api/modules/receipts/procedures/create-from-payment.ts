import { ORPCError } from "@orpc/server";
import { and, db, eq, isNull, receipts } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { formatAmount, safeTrackActivity } from "../../activities/lib";
import { requirePermission } from "../../studio/lib/permissions";
import {
	createReceiptFromPaymentInputSchema,
	createReceiptFromPaymentOutputSchema,
} from "../../studio/schemas/receipt";
import { getLockedReceivedPayment } from "../../studio-payments/lib/received-payment-lock";
import {
	getLockedBookingForReceipt,
	getLockedInvoiceForReceipt,
} from "../lib/locked-invoice-for-receipt";
import {
	generateReceiptNumber,
	updateInvoicePaymentStatus,
} from "../lib/receipt-helpers";

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

		const { bookingId, invoiceId, receivedAmountId } = input;

		return await db.transaction(async (tx) => {
			const booking = await getLockedBookingForReceipt(tx, {
				organizationId: context.organizationId,
				bookingId,
			});

			if (!booking) {
				throw new ORPCError("NOT_FOUND", {
					message: "Booking not found",
				});
			}

			const invoice = await getLockedInvoiceForReceipt(tx, {
				organizationId: context.organizationId,
				bookingId,
				invoiceId,
			});

			if (!invoice) {
				throw new ORPCError("NOT_FOUND", {
					message:
						"Invoice not found or does not belong to this booking",
				});
			}

			const received = await getLockedReceivedPayment(tx, {
				organizationId: context.organizationId,
				receivedAmountId,
			});

			if (!received) {
				throw new ORPCError("NOT_FOUND", {
					message: "Received payment not found",
				});
			}

			if (
				received.bookingId !== bookingId ||
				received.invoiceId !== invoiceId
			) {
				throw new ORPCError("CONFLICT", {
					message:
						"Received payment does not match the supplied booking or invoice",
				});
			}

			const existingReceipt = await tx.query.receipts.findFirst({
				where: and(
					eq(receipts.organizationId, context.organizationId),
					eq(receipts.receivedAmountId, received.id),
					isNull(receipts.deletedAt),
				),
				columns: { id: true },
			});

			if (existingReceipt) {
				return {
					data: { id: existingReceipt.id },
					message: "Receipt already exists",
				};
			}

			const receiptNumber = await generateReceiptNumber(
				bookingId,
				context.organizationId,
				tx,
			);

			const [created] = await tx
				.insert(receipts)
				.values({
					organizationId: context.organizationId,
					bookingId,
					invoiceId,
					receivedAmountId,
					receiptNumber,
					amount: received.amount,
					paymentMethod: received.paymentMethod,
					receiptDate: received.receivedDate,
					notes: received.notes,
					createdBy: context.user.id,
					updatedBy: context.user.id,
				})
				.returning({ id: receipts.id });

			if (!created) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Failed to create receipt",
				});
			}

			await updateInvoicePaymentStatus(tx, invoiceId, context.user.id);

			await safeTrackActivity(context, {
				entityType: "received_amount",
				entityId: created.id,
				entityName: `Receipt ${receiptNumber} (${formatAmount(received.amount)})`,
				action: "created",
				parentEntityType: "booking",
				parentEntityId: bookingId,
				parentEntityName: booking.name,
				metadata: {
					receiptNumber,
					amount: received.amount,
					invoiceNumber: invoice.invoiceNumber,
					type: "receipt",
				},
			});

			return {
				data: { id: created.id },
				message: "Receipt created successfully",
			};
		});
	});
