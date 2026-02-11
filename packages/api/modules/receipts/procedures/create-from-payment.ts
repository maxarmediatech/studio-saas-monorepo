import { ORPCError } from "@orpc/server";
import {
	and,
	bookings,
	db,
	eq,
	invoices,
	isNull,
	receipts,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { formatAmount, safeTrackActivity } from "../../activities/lib";
import { requirePermission } from "../../studio/lib/permissions";
import {
	createReceiptFromPaymentInputSchema,
	createReceiptFromPaymentOutputSchema,
} from "../../studio/schemas/receipt";
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

		const {
			bookingId,
			invoiceId,
			receivedAmountId,
			amount,
			paymentMethod,
			receiptDate,
			notes,
		} = input;

		const booking = await db.query.bookings.findFirst({
			where: and(
				eq(bookings.id, bookingId),
				eq(bookings.organizationId, context.organizationId),
				isNull(bookings.deletedAt),
			),
			columns: { id: true, name: true },
		});

		if (!booking) {
			throw new ORPCError("NOT_FOUND", {
				message: "Booking not found",
			});
		}

		const invoice = await db.query.invoices.findFirst({
			where: and(
				eq(invoices.id, invoiceId),
				eq(invoices.organizationId, context.organizationId),
				isNull(invoices.deletedAt),
			),
			columns: { id: true, invoiceNumber: true },
		});

		if (!invoice) {
			throw new ORPCError("NOT_FOUND", {
				message: "Invoice not found",
			});
		}

		return await db.transaction(async (tx) => {
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
					amount,
					paymentMethod: paymentMethod ?? null,
					receiptDate,
					notes: notes ?? null,
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
				entityName: `Receipt ${receiptNumber} (${formatAmount(amount)})`,
				action: "created",
				parentEntityType: "booking",
				parentEntityId: bookingId,
				parentEntityName: booking.name,
				metadata: {
					receiptNumber,
					amount,
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
