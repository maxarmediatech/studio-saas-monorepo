import { ORPCError } from "@orpc/server";
import {
	and,
	bookings,
	eq,
	isNull,
	paymentSchedules,
	receipts,
	receivedAmounts,
	sql,
} from "@repo/database";
import {
	getLockedBookingForReceipt,
	getLockedInvoiceForReceipt,
	getLockedReceiptHistoryForPayment,
	getLockedScheduleForReceipt,
} from "../../receipts/lib/locked-invoice-for-receipt";
import { updateInvoicePaymentStatus } from "../../receipts/lib/receipt-helpers";
import { insertReceiptWithGeneratedNumber } from "../../receipts/lib/receipt-transition-service";
import { centsToMoney, moneyToCents } from "../../studio/lib/money";
import type { TransactionClient } from "../../studio/lib/transactions";
import type { CorrectReceivedInput } from "../../studio/schemas/payment";
import { getLockedReceivedPayment } from "./received-payment-lock";
import { createReceivedPaymentTransition } from "./schedule-payment-service";

interface PaymentCorrectionActor {
	organizationId: string;
	userId: string;
}

export async function correctReceivedPaymentTransition(
	tx: TransactionClient,
	input: CorrectReceivedInput & PaymentCorrectionActor,
) {
	const lockPlan = await tx.query.receivedAmounts.findFirst({
		where: and(
			eq(receivedAmounts.id, input.id),
			eq(receivedAmounts.organizationId, input.organizationId),
			isNull(receivedAmounts.deletedAt),
		),
		columns: {
			bookingId: true,
			invoiceId: true,
			paymentScheduleId: true,
		},
	});
	if (!lockPlan) {
		throw new ORPCError("NOT_FOUND", {
			message: "Active payment not found",
		});
	}

	const booking = await getLockedBookingForReceipt(tx, {
		organizationId: input.organizationId,
		bookingId: lockPlan.bookingId,
	});
	if (!booking) {
		throw new ORPCError("NOT_FOUND", { message: "Booking not found" });
	}
	if (lockPlan.invoiceId) {
		const invoice = await getLockedInvoiceForReceipt(tx, {
			organizationId: input.organizationId,
			bookingId: lockPlan.bookingId,
			invoiceId: lockPlan.invoiceId,
		});
		if (!invoice) {
			throw new ORPCError("CONFLICT", {
				message: "The payment invoice is no longer available",
			});
		}
	}
	if (lockPlan.paymentScheduleId) {
		const schedule = await getLockedScheduleForReceipt(tx, {
			organizationId: input.organizationId,
			bookingId: lockPlan.bookingId,
			paymentScheduleId: lockPlan.paymentScheduleId,
		});
		if (!schedule) {
			throw new ORPCError("CONFLICT", {
				message: "The payment schedule is no longer available",
			});
		}
	}

	const original = await getLockedReceivedPayment(tx, {
		organizationId: input.organizationId,
		receivedAmountId: input.id,
	});
	if (!original) {
		throw new ORPCError("CONFLICT", {
			message: "This payment was already corrected or removed",
		});
	}
	if (
		original.bookingId !== lockPlan.bookingId ||
		original.invoiceId !== lockPlan.invoiceId ||
		original.paymentScheduleId !== lockPlan.paymentScheduleId
	) {
		throw new ORPCError("CONFLICT", {
			message: "Payment relationships changed. Retry the correction.",
		});
	}

	await getLockedReceiptHistoryForPayment(tx, {
		organizationId: input.organizationId,
		receivedAmountId: original.id,
	});
	const activeReceipt = await tx.query.receipts.findFirst({
		where: and(
			eq(receipts.organizationId, input.organizationId),
			eq(receipts.receivedAmountId, original.id),
			isNull(receipts.deletedAt),
		),
	});
	const reversedAt = new Date();
	if (activeReceipt) {
		const voidNote = `[Voided: payment correction — ${input.reason.trim()}]`;
		await tx
			.update(receipts)
			.set({
				deletedAt: reversedAt,
				deletedBy: input.userId,
				updatedAt: reversedAt,
				updatedBy: input.userId,
				notes: activeReceipt.notes
					? `${activeReceipt.notes}\n\n${voidNote}`
					: voidNote,
			})
			.where(eq(receipts.id, activeReceipt.id));
	}

	await tx
		.update(receivedAmounts)
		.set({
			reversedAt,
			reversedBy: input.userId,
			reversalReason: input.reason.trim(),
			deletedAt: reversedAt,
			deletedBy: input.userId,
			updatedAt: reversedAt,
			updatedBy: input.userId,
		})
		.where(eq(receivedAmounts.id, original.id));

	const [bookingTotal] = await tx
		.select({
			amount: sql<string>`COALESCE(SUM(${receivedAmounts.amount}), 0)`,
		})
		.from(receivedAmounts)
		.where(
			and(
				eq(receivedAmounts.organizationId, input.organizationId),
				eq(receivedAmounts.bookingId, original.bookingId),
				isNull(receivedAmounts.deletedAt),
			),
		);
	await tx
		.update(bookings)
		.set({
			totalReceived: bookingTotal?.amount ?? "0.00",
			updatedAt: reversedAt,
			updatedBy: input.userId,
		})
		.where(eq(bookings.id, original.bookingId));

	if (original.invoiceId) {
		await updateInvoicePaymentStatus(tx, original.invoiceId, input.userId);
	}
	if (original.paymentScheduleId) {
		const [scheduleTotal] = await tx
			.select({
				amount: sql<string>`COALESCE(SUM(${receivedAmounts.amount}), 0)`,
			})
			.from(receivedAmounts)
			.where(
				and(
					eq(receivedAmounts.organizationId, input.organizationId),
					eq(
						receivedAmounts.paymentScheduleId,
						original.paymentScheduleId,
					),
					isNull(receivedAmounts.deletedAt),
				),
			);
		const paidAmount = scheduleTotal?.amount ?? "0.00";
		const paidCents = moneyToCents(paidAmount);
		const schedule = await tx.query.paymentSchedules.findFirst({
			where: eq(paymentSchedules.id, original.paymentScheduleId),
			columns: { amount: true, status: true },
		});
		if (!schedule) {
			throw new ORPCError("CONFLICT", {
				message: "The payment schedule is no longer available",
			});
		}
		const scheduleAmountCents = moneyToCents(schedule.amount);
		const status =
			schedule.status === "cancelled"
				? "cancelled"
				: paidCents === 0
					? "pending"
					: paidCents >= scheduleAmountCents
						? "completed"
						: "partial";
		await tx
			.update(paymentSchedules)
			.set({
				paidAmount: centsToMoney(paidCents),
				paidAt: status === "completed" ? reversedAt : null,
				status,
				updatedAt: reversedAt,
				updatedBy: input.userId,
			})
			.where(eq(paymentSchedules.id, original.paymentScheduleId));
	}

	const replacement = await createReceivedPaymentTransition(tx, {
		organizationId: input.organizationId,
		userId: input.userId,
		bookingId: original.bookingId,
		invoiceId: original.invoiceId ?? undefined,
		paymentScheduleId: original.paymentScheduleId ?? undefined,
		amount: input.amount,
		paymentMethod: input.paymentMethod,
		transactionReference: input.transactionReference ?? undefined,
		receivedDate: input.receivedDate,
		notes: input.notes ?? undefined,
		proofAttachment: original.proofAttachment as {
			name: string;
			size: number;
			type: string;
			key: string;
			url: string;
		} | null,
	});
	if (activeReceipt && !original.invoiceId) {
		await insertReceiptWithGeneratedNumber(tx, {
			organizationId: input.organizationId,
			bookingId: original.bookingId,
			values: {
				organizationId: input.organizationId,
				bookingId: original.bookingId,
				invoiceId: null,
				receivedAmountId: replacement.id,
				amount: input.amount,
				paymentMethod: input.paymentMethod,
				receiptDate: input.receivedDate,
				notes: input.notes,
				createdBy: input.userId,
				updatedBy: input.userId,
			},
		});
	}
	await tx
		.update(receivedAmounts)
		.set({ replacesPaymentId: original.id })
		.where(eq(receivedAmounts.id, replacement.id));
	await tx
		.update(receivedAmounts)
		.set({ replacementPaymentId: replacement.id })
		.where(eq(receivedAmounts.id, original.id));

	return {
		originalId: original.id,
		replacementId: replacement.id,
		bookingId: original.bookingId,
		bookingName: replacement.bookingName,
	};
}
