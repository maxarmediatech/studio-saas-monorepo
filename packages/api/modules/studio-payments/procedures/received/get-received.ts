import { ORPCError } from "@orpc/server";
import {
	and,
	bookings,
	db,
	desc,
	eq,
	isNull,
	paymentSchedules,
	receipts,
	receivedAmounts,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../../orpc/procedures";
import { requirePermission } from "../../../studio/lib/permissions";
import {
	getReceivedInputSchema,
	getReceivedOutputSchema,
} from "../../../studio/schemas/payment";
import { getPaymentFinancialProtection } from "../../lib/payment-financial-protection";

export const getReceived = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/studio-payments/received/{id}",
		tags: ["Studio Payments"],
		summary: "Get received payment",
		description:
			"Get detailed information about a specific received payment",
	})
	.input(getReceivedInputSchema)
	.output(getReceivedOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "payment", "read");

		const { id } = input;

		// Get received amount with booking info
		const result = await db
			.select({
				id: receivedAmounts.id,
				organizationId: receivedAmounts.organizationId,
				bookingId: receivedAmounts.bookingId,
				amount: receivedAmounts.amount,
				paymentMethod: receivedAmounts.paymentMethod,
				transactionReference: receivedAmounts.transactionReference,
				receivedDate: receivedAmounts.receivedDate,
				notes: receivedAmounts.notes,
				proofAttachment: receivedAmounts.proofAttachment,
				paymentScheduleId: receivedAmounts.paymentScheduleId,
				invoiceId: receivedAmounts.invoiceId,
				replacesPaymentId: receivedAmounts.replacesPaymentId,
				replacementPaymentId: receivedAmounts.replacementPaymentId,
				reversedAt: receivedAmounts.reversedAt,
				reversedBy: receivedAmounts.reversedBy,
				reversalReason: receivedAmounts.reversalReason,
				createdBy: receivedAmounts.createdBy,
				updatedBy: receivedAmounts.updatedBy,
				createdAt: receivedAmounts.createdAt,
				updatedAt: receivedAmounts.updatedAt,
				deletedAt: receivedAmounts.deletedAt,
				deletedBy: receivedAmounts.deletedBy,
				bookingName: bookings.name,
				bookingReferenceNumber: bookings.referenceNumber,
			})
			.from(receivedAmounts)
			.innerJoin(bookings, eq(receivedAmounts.bookingId, bookings.id))
			.where(
				and(
					eq(receivedAmounts.id, id),
					eq(receivedAmounts.organizationId, context.organizationId),
					isNull(receivedAmounts.deletedAt),
				),
			)
			.limit(1);

		const received = result[0];

		if (!received) {
			throw new ORPCError("NOT_FOUND", {
				message: "Received payment not found",
			});
		}

		const [scheduleResult, financialProtection, originalPayment] =
			await Promise.all([
				received.paymentScheduleId
					? db
							.select({
								id: paymentSchedules.id,
								name: paymentSchedules.name,
							})
							.from(paymentSchedules)
							.where(
								eq(
									paymentSchedules.id,
									received.paymentScheduleId,
								),
							)
							.limit(1)
					: Promise.resolve([]),
				getPaymentFinancialProtection(db, {
					organizationId: context.organizationId,
					receivedAmountId: received.id,
					invoiceId: received.invoiceId,
					paymentScheduleId: received.paymentScheduleId,
				}),
				received.replacesPaymentId
					? db.query.receivedAmounts.findFirst({
							where: and(
								eq(
									receivedAmounts.id,
									received.replacesPaymentId,
								),
								eq(
									receivedAmounts.organizationId,
									context.organizationId,
								),
							),
						})
					: null,
			]);
		const voidedReceipt = originalPayment
			? await db.query.receipts.findFirst({
					where: and(
						eq(receipts.organizationId, context.organizationId),
						eq(receipts.receivedAmountId, originalPayment.id),
					),
					orderBy: desc(receipts.createdAt),
				})
			: null;

		return {
			data: {
				id: received.id,
				organizationId: received.organizationId,
				bookingId: received.bookingId,
				amount: received.amount,
				paymentMethod: received.paymentMethod,
				transactionReference: received.transactionReference,
				receivedDate: received.receivedDate,
				notes: received.notes,
				proofAttachment: received.proofAttachment as {
					name: string;
					size: number;
					type: string;
					key: string;
					url: string;
				} | null,
				paymentScheduleId: received.paymentScheduleId,
				invoiceId: received.invoiceId,
				replacesPaymentId: received.replacesPaymentId,
				replacementPaymentId: received.replacementPaymentId,
				reversedAt: received.reversedAt?.toISOString() ?? null,
				reversedBy: received.reversedBy,
				reversalReason: received.reversalReason,
				createdBy: received.createdBy,
				updatedBy: received.updatedBy,
				createdAt: received.createdAt.toISOString(),
				updatedAt: received.updatedAt.toISOString(),
				deletedAt: received.deletedAt?.toISOString() ?? null,
				deletedBy: received.deletedBy,
				booking: {
					id: received.bookingId,
					name: received.bookingName,
					referenceNumber: received.bookingReferenceNumber,
				},
				schedule: scheduleResult[0] ?? null,
				financialProtection,
				correction:
					originalPayment?.reversedAt &&
					originalPayment.reversalReason
						? {
								originalPaymentId: originalPayment.id,
								originalAmount: originalPayment.amount,
								originalPaymentMethod:
									originalPayment.paymentMethod,
								originalReceivedDate:
									originalPayment.receivedDate,
								reason: originalPayment.reversalReason,
								reversedAt:
									originalPayment.reversedAt.toISOString(),
								voidedReceiptNumber:
									voidedReceipt?.receiptNumber ?? null,
							}
						: null,
			},
		};
	});
