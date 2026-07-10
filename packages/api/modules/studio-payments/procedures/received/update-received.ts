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
import { getLockedBookingForReceipt } from "../../../receipts/lib/locked-invoice-for-receipt";
import { requirePermission } from "../../../studio/lib/permissions";
import {
	updateReceivedInputSchema,
	updateReceivedOutputSchema,
} from "../../../studio/schemas/payment";
import {
	assertPaymentFinancialDetailsEditable,
	getPaymentFinancialProtection,
} from "../../lib/payment-financial-protection";
import { getLockedReceivedPayment } from "../../lib/received-payment-lock";

export const updateReceived = studioProtectedProcedure
	.route({
		method: "PUT",
		path: "/studio-payments/received/{id}",
		tags: ["Studio Payments"],
		summary: "Update received payment",
		description: "Update an existing received payment record",
	})
	.input(updateReceivedInputSchema)
	.output(updateReceivedOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "payment", "update");

		const { id, ...updates } = input;

		// Security: Validate S3 key belongs to this organization (prevents IDOR)
		if (updates.proofAttachment?.key) {
			const expectedPrefix = `orgs/${context.organizationId}/`;
			if (!updates.proofAttachment.key.startsWith(expectedPrefix)) {
				throw new ORPCError("FORBIDDEN", {
					message:
						"Invalid payment proof: file does not belong to this organization",
				});
			}
		}

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
						"Received payment booking changed during update. Retry the request.",
				});
			}

			const oldAmount = Number.parseFloat(received.amount);
			const newAmount = updates.amount
				? Number.parseFloat(updates.amount)
				: oldAmount;
			const amountChanged =
				updates.amount !== undefined && newAmount !== oldAmount;
			const financialDetailsChanged =
				amountChanged ||
				(updates.paymentMethod !== undefined &&
					updates.paymentMethod !== received.paymentMethod) ||
				(updates.receivedDate !== undefined &&
					updates.receivedDate !== received.receivedDate);

			if (financialDetailsChanged) {
				const protection = await getPaymentFinancialProtection(tx, {
					organizationId: context.organizationId,
					receivedAmountId: received.id,
					invoiceId: received.invoiceId,
					paymentScheduleId: received.paymentScheduleId,
				});

				assertPaymentFinancialDetailsEditable(protection);
			}

			const updateData: Record<string, unknown> = {
				updatedAt: new Date(),
				updatedBy: context.user.id,
			};

			if (updates.amount !== undefined) {
				updateData.amount = updates.amount;
			}

			if (updates.paymentMethod !== undefined) {
				updateData.paymentMethod = updates.paymentMethod;
			}

			if (updates.transactionReference !== undefined) {
				updateData.transactionReference = updates.transactionReference;
			}

			if (updates.receivedDate !== undefined) {
				updateData.receivedDate = updates.receivedDate;
			}

			if (updates.notes !== undefined) {
				updateData.notes = updates.notes;
			}

			if (updates.proofAttachment !== undefined) {
				updateData.proofAttachment = updates.proofAttachment;
			}

			// Update received amount
			await tx
				.update(receivedAmounts)
				.set(updateData)
				.where(eq(receivedAmounts.id, id));

			if (amountChanged) {
				// Update booking total (subtract old, add new)
				const amountDiff = newAmount - oldAmount;
				await tx
					.update(bookings)
					.set({
						totalReceived: sql`${bookings.totalReceived} + ${amountDiff.toFixed(2)}`,
						updatedAt: new Date(),
						updatedBy: context.user.id,
					})
					.where(eq(bookings.id, received.bookingId));
			}

			return {
				data: { id },
				message: "Payment updated successfully",
			};
		});
	});
