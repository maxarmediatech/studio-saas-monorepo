import { ORPCError } from "@orpc/server";
import {
	bookings,
	db,
	eq,
	paymentSchedules,
	receipts,
	receivedAmounts,
	sql,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../../orpc/procedures";
import { formatAmount, safeTrackActivity } from "../../../activities/lib";
import {
	getLockedBookingForReceipt,
	getLockedInvoiceForReceipt,
	getLockedScheduleForReceipt,
} from "../../../receipts/lib/locked-invoice-for-receipt";
import {
	generateReceiptNumber,
	updateInvoicePaymentStatus,
} from "../../../receipts/lib/receipt-helpers";
import { requirePermission } from "../../../studio/lib/permissions";
import {
	createReceivedInputSchema,
	createReceivedOutputSchema,
} from "../../../studio/schemas/payment";
import { buildSchedulePaymentTransition } from "../../lib/schedule-payment-transition";

export const createReceived = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/studio-payments/received",
		tags: ["Studio Payments"],
		summary: "Create received payment",
		description: "Record a new payment received from a client",
	})
	.input(createReceivedInputSchema)
	.output(createReceivedOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "payment", "create");

		const {
			bookingId,
			amount,
			paymentMethod,
			transactionReference,
			receivedDate,
			notes,
			proofAttachment,
			paymentScheduleId,
			invoiceId,
		} = input;

		// Security: Validate S3 key belongs to this organization (prevents IDOR)
		if (proofAttachment?.key) {
			const expectedPrefix = `orgs/${context.organizationId}/`;
			if (!proofAttachment.key.startsWith(expectedPrefix)) {
				throw new ORPCError("FORBIDDEN", {
					message:
						"Invalid payment proof: file does not belong to this organization",
				});
			}
		}

		// Use transaction to create received amount and update booking totals
		return await db.transaction(async (tx) => {
			const lockedBooking = await getLockedBookingForReceipt(tx, {
				organizationId: context.organizationId,
				bookingId,
			});

			if (!lockedBooking) {
				throw new ORPCError("NOT_FOUND", {
					message: "Booking not found",
				});
			}

			const invoice = invoiceId
				? await getLockedInvoiceForReceipt(tx, {
						organizationId: context.organizationId,
						bookingId,
						invoiceId,
					})
				: null;

			if (invoiceId && !invoice) {
				throw new ORPCError("NOT_FOUND", {
					message:
						"Invoice not found or does not belong to this booking",
				});
			}

			const schedule = paymentScheduleId
				? await getLockedScheduleForReceipt(tx, {
						organizationId: context.organizationId,
						bookingId,
						paymentScheduleId,
					})
				: null;

			if (paymentScheduleId && !schedule) {
				throw new ORPCError("NOT_FOUND", {
					message: "Payment schedule not found",
				});
			}

			if (
				invoice &&
				schedule &&
				invoice.paymentScheduleId !== schedule.id
			) {
				throw new ORPCError("CONFLICT", {
					message:
						"Invoice does not belong to the selected payment schedule",
				});
			}

			const scheduleUpdate = schedule
				? buildSchedulePaymentTransition(
						schedule,
						amount,
						"Cancelled schedule cannot receive payments",
					)
				: null;

			// Create received amount
			const [created] = await tx
				.insert(receivedAmounts)
				.values({
					organizationId: context.organizationId,
					bookingId,
					amount,
					paymentMethod,
					transactionReference: transactionReference ?? null,
					receivedDate,
					notes: notes ?? null,
					proofAttachment: proofAttachment ?? null,
					paymentScheduleId: paymentScheduleId ?? null,
					invoiceId: invoiceId ?? null,
					createdBy: context.user.id,
					updatedBy: context.user.id,
				})
				.returning({ id: receivedAmounts.id });

			if (!created) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Failed to create received payment",
				});
			}

			if (invoice && invoiceId) {
				const receiptNumber = await generateReceiptNumber(
					bookingId,
					context.organizationId,
					tx,
				);

				await tx.insert(receipts).values({
					organizationId: context.organizationId,
					bookingId,
					invoiceId,
					receivedAmountId: created.id,
					receiptNumber,
					amount,
					paymentMethod,
					receiptDate: receivedDate,
					notes: notes ?? null,
					createdBy: context.user.id,
					updatedBy: context.user.id,
				});

				await updateInvoicePaymentStatus(
					tx,
					invoiceId,
					context.user.id,
				);
			}

			// Update booking total received
			await tx
				.update(bookings)
				.set({
					totalReceived: sql`${bookings.totalReceived} + ${amount}`,
					updatedAt: new Date(),
					updatedBy: context.user.id,
				})
				.where(eq(bookings.id, bookingId));

			if (paymentScheduleId && scheduleUpdate) {
				await tx
					.update(paymentSchedules)
					.set({
						paidAmount: scheduleUpdate.paidAmount,
						paidAt: scheduleUpdate.paidAt,
						status: scheduleUpdate.status,
						updatedAt: new Date(),
						updatedBy: context.user.id,
					})
					.where(eq(paymentSchedules.id, paymentScheduleId));
			}

			// Track activity (non-blocking, outside transaction)
			await safeTrackActivity(
				{ organizationId: context.organizationId, user: context.user },
				{
					entityType: "received_amount",
					entityId: created.id,
					entityName: `${formatAmount(amount)} via ${paymentMethod}`,
					action: "payment_received",
					parentEntityType: "booking",
					parentEntityId: bookingId,
					parentEntityName: lockedBooking.name,
					metadata: { amount, paymentMethod },
				},
			);

			return {
				data: { id: created.id },
				message: "Payment recorded successfully",
			};
		});
	});
