/**
 * Create Payments Batch Helper
 *
 * Creates payment schedules and received payments within a transaction.
 * Also updates the booking's totalReceived field.
 */

import { ORPCError } from "@orpc/server";
import {
	bookings,
	eq,
	paymentSchedules,
	receivedAmounts,
	sql,
} from "@repo/database";
import type { TransactionClient } from "../../studio/lib/transactions";
import type {
	PaymentScheduleInput,
	ReceivedPaymentInput,
} from "../../studio/schemas/booking";

export interface CreatePaymentsBatchResult {
	receivedIds: string[];
	scheduleIds: string[];
	totalReceived: string;
}

/**
 * Creates received payments and payment schedules, updating booking.totalReceived.
 *
 * @param tx - Transaction client
 * @param organizationId - Organization ID
 * @param bookingId - Booking ID to associate payments with
 * @param userId - User ID for audit fields
 * @param receivedPayments - Array of received payment data to create
 * @param schedules - Array of payment schedule data to create
 * @returns Object containing created IDs and total received amount
 */
export async function createPaymentsBatch(
	tx: TransactionClient,
	organizationId: string,
	bookingId: string,
	userId: string,
	receivedPayments: ReceivedPaymentInput[],
	schedules: PaymentScheduleInput[],
): Promise<CreatePaymentsBatchResult> {
	const receivedIds: string[] = [];
	const scheduleIds: string[] = [];
	let totalReceivedAmount = 0;

	// Create payment schedules first (batch insert)
	if (schedules.length > 0) {
		const createdSchedules = await tx
			.insert(paymentSchedules)
			.values(
				schedules.map((schedule, index) => ({
					organizationId,
					bookingId,
					name: schedule.name,
					amount: schedule.amount,
					dueDate: schedule.dueDate,
					percentage: schedule.percentage ?? null,
					timing: schedule.timing ?? null,
					taxType: "no_gst" as const,
					status: "pending" as const,
					paidAmount: "0",
					notes: schedule.notes ?? null,
					sortOrder: schedule.sortOrder ?? index,
					createdBy: userId,
					updatedBy: userId,
				})),
			)
			.returning({ id: paymentSchedules.id });

		scheduleIds.push(...createdSchedules.map((s) => s.id));
	}

	// Security: Validate all proof attachment keys belong to this organization (prevents IDOR)
	const expectedPrefix = `orgs/${organizationId}/`;
	for (const payment of receivedPayments) {
		if (
			payment.proofAttachment?.key &&
			!payment.proofAttachment.key.startsWith(expectedPrefix)
		) {
			throw new ORPCError("FORBIDDEN", {
				message:
					"Invalid payment proof: file does not belong to this organization",
			});
		}
	}

	// Create received payments (batch insert)
	if (receivedPayments.length > 0) {
		const createdReceived = await tx
			.insert(receivedAmounts)
			.values(
				receivedPayments.map((payment) => ({
					organizationId,
					bookingId,
					amount: payment.amount,
					paymentMethod: payment.paymentMethod,
					receivedDate: payment.receivedDate,
					transactionReference: payment.transactionReference ?? null,
					notes: payment.notes ?? null,
					proofAttachment: payment.proofAttachment ?? null,
					paymentScheduleId: null, // Not linking to schedules during creation
					createdBy: userId,
					updatedBy: userId,
				})),
			)
			.returning({ id: receivedAmounts.id });

		receivedIds.push(...createdReceived.map((r) => r.id));

		// Calculate total received
		totalReceivedAmount = receivedPayments.reduce(
			(sum, p) => sum + Number.parseFloat(p.amount),
			0,
		);
	}

	// Update booking.totalReceived if we have received payments
	if (totalReceivedAmount > 0) {
		await tx
			.update(bookings)
			.set({
				totalReceived: sql`${bookings.totalReceived} + ${totalReceivedAmount.toFixed(2)}`,
				updatedAt: new Date(),
				updatedBy: userId,
			})
			.where(eq(bookings.id, bookingId));
	}

	return {
		receivedIds,
		scheduleIds,
		totalReceived: totalReceivedAmount.toFixed(2),
	};
}
