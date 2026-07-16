import { ORPCError } from "@orpc/server";
import {
	and,
	bookings,
	db,
	eq,
	isNull,
	receivedAmounts,
	sql,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../../orpc/procedures";
import { formatAmount, safeTrackActivity } from "../../../activities/lib";
import { getLockedBookingForReceipt } from "../../../receipts/lib/locked-invoice-for-receipt";
import { requirePermission } from "../../../studio/lib/permissions";
import {
	deleteReceivedInputSchema,
	deleteReceivedOutputSchema,
} from "../../../studio/schemas/payment";
import {
	assertPaymentDeletable,
	getPaymentFinancialProtection,
} from "../../lib/payment-financial-protection";
import { getLockedReceivedPayment } from "../../lib/received-payment-lock";

export const deleteReceived = studioProtectedProcedure
	.route({
		method: "DELETE",
		path: "/studio-payments/received/{id}",
		tags: ["Studio Payments"],
		summary: "Delete received payment",
		description: "Soft delete a received payment record",
	})
	.input(deleteReceivedInputSchema)
	.output(deleteReceivedOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "payment", "delete");

		const { id } = input;

		// Use transaction to soft delete and update booking totals
		return await db.transaction(async (tx) => {
			const lockPlan = await tx.query.receivedAmounts.findFirst({
				where: and(
					eq(receivedAmounts.id, id),
					eq(receivedAmounts.organizationId, context.organizationId),
					isNull(receivedAmounts.deletedAt),
				),
				columns: { bookingId: true },
			});

			if (!lockPlan) {
				throw new ORPCError("NOT_FOUND", {
					message: "Received payment not found",
				});
			}

			const booking = await getLockedBookingForReceipt(tx, {
				organizationId: context.organizationId,
				bookingId: lockPlan.bookingId,
			});

			if (!booking) {
				throw new ORPCError("NOT_FOUND", {
					message: "Booking not found",
				});
			}

			const received = await getLockedReceivedPayment(tx, {
				organizationId: context.organizationId,
				receivedAmountId: id,
			});

			if (!received) {
				throw new ORPCError("NOT_FOUND", {
					message: "Received payment not found",
				});
			}

			if (received.bookingId !== lockPlan.bookingId) {
				throw new ORPCError("CONFLICT", {
					message:
						"Received payment booking changed during deletion. Retry the request.",
				});
			}

			const protection = await getPaymentFinancialProtection(tx, {
				organizationId: context.organizationId,
				receivedAmountId: received.id,
				invoiceId: received.invoiceId,
				paymentScheduleId: received.paymentScheduleId,
			});

			assertPaymentDeletable(protection);

			const amount = Number.parseFloat(received.amount);

			// Soft delete
			await tx
				.update(receivedAmounts)
				.set({
					deletedAt: new Date(),
					deletedBy: context.user.id,
					updatedAt: new Date(),
					updatedBy: context.user.id,
				})
				.where(eq(receivedAmounts.id, id));

			// Update booking total (subtract the deleted amount)
			await tx
				.update(bookings)
				.set({
					totalReceived: sql`${bookings.totalReceived} - ${amount.toFixed(2)}`,
					updatedAt: new Date(),
					updatedBy: context.user.id,
				})
				.where(eq(bookings.id, received.bookingId));

			// Track activity (non-blocking)
			await safeTrackActivity(
				{ organizationId: context.organizationId, user: context.user },
				{
					entityType: "received_amount",
					entityId: id,
					entityName: `${formatAmount(received.amount)} via ${received.paymentMethod}`,
					action: "deleted",
					parentEntityType: "booking",
					parentEntityId: received.bookingId,
					parentEntityName: booking.name,
					metadata: {
						amount: received.amount,
						paymentMethod: received.paymentMethod,
					},
				},
			);

			return {
				data: { id },
				message: "Payment deleted successfully",
			};
		});
	});
