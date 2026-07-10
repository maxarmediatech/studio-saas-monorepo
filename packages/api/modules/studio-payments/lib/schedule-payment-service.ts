import { ORPCError } from "@orpc/server";
import {
	and,
	bookings,
	eq,
	invoices,
	isNull,
	paymentSchedules,
	receivedAmounts,
	sql,
} from "@repo/database";
import {
	getLockedBookingForReceipt,
	getLockedInvoiceForReceipt,
	getLockedScheduleForReceipt,
	getLockedScheduleInvoiceForReceipt,
} from "../../receipts/lib/locked-invoice-for-receipt";
import { updateInvoicePaymentStatus } from "../../receipts/lib/receipt-helpers";
import { insertReceiptWithGeneratedNumber } from "../../receipts/lib/receipt-transition-service";
import type { TransactionClient } from "../../studio/lib/transactions";
import type {
	ConvertScheduleInput,
	CreateReceivedInput,
} from "../../studio/schemas/payment";
import { buildSchedulePaymentTransition } from "./schedule-payment-transition";

interface PaymentActor {
	organizationId: string;
	userId: string;
}

export const SCHEDULE_ALREADY_CONVERTED_MESSAGE =
	"Payment schedule has already been converted";

export async function createReceivedPaymentTransition(
	tx: TransactionClient,
	input: Omit<CreateReceivedInput, "idempotencyKey"> & PaymentActor,
) {
	const booking = await getLockedBookingForReceipt(tx, input);
	if (!booking) {
		throw new ORPCError("NOT_FOUND", { message: "Booking not found" });
	}

	const invoice = input.invoiceId
		? await getLockedInvoiceForReceipt(tx, {
				organizationId: input.organizationId,
				bookingId: input.bookingId,
				invoiceId: input.invoiceId,
			})
		: null;
	if (input.invoiceId && !invoice) {
		throw new ORPCError("NOT_FOUND", {
			message: "Invoice not found or does not belong to this booking",
		});
	}

	const schedule = input.paymentScheduleId
		? await getLockedScheduleForReceipt(tx, {
				organizationId: input.organizationId,
				bookingId: input.bookingId,
				paymentScheduleId: input.paymentScheduleId,
			})
		: null;
	if (input.paymentScheduleId && !schedule) {
		throw new ORPCError("NOT_FOUND", {
			message: "Payment schedule not found",
		});
	}
	if (invoice && schedule && invoice.paymentScheduleId !== schedule.id) {
		throw new ORPCError("CONFLICT", {
			message: "Invoice does not belong to the selected payment schedule",
		});
	}

	const scheduleUpdate = schedule
		? buildSchedulePaymentTransition(
				schedule,
				input.amount,
				"Cancelled schedule cannot receive payments",
			)
		: null;
	const [created] = await tx
		.insert(receivedAmounts)
		.values({
			organizationId: input.organizationId,
			bookingId: input.bookingId,
			amount: input.amount,
			paymentMethod: input.paymentMethod,
			transactionReference: input.transactionReference ?? null,
			receivedDate: input.receivedDate,
			notes: input.notes ?? null,
			proofAttachment: input.proofAttachment ?? null,
			paymentScheduleId: input.paymentScheduleId ?? null,
			invoiceId: input.invoiceId ?? null,
			createdBy: input.userId,
			updatedBy: input.userId,
		})
		.returning({ id: receivedAmounts.id });
	if (!created) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Failed to create received payment",
		});
	}

	if (invoice && input.invoiceId) {
		await insertReceiptWithGeneratedNumber(tx, {
			organizationId: input.organizationId,
			bookingId: input.bookingId,
			values: {
				organizationId: input.organizationId,
				bookingId: input.bookingId,
				invoiceId: input.invoiceId,
				receivedAmountId: created.id,
				amount: input.amount,
				paymentMethod: input.paymentMethod,
				receiptDate: input.receivedDate,
				notes: input.notes ?? null,
				createdBy: input.userId,
				updatedBy: input.userId,
			},
		});
		await updateInvoicePaymentStatus(tx, input.invoiceId, input.userId);
	}

	await tx
		.update(bookings)
		.set({
			totalReceived: sql`${bookings.totalReceived} + ${input.amount}`,
			updatedAt: new Date(),
			updatedBy: input.userId,
		})
		.where(eq(bookings.id, input.bookingId));

	if (input.paymentScheduleId && scheduleUpdate) {
		await tx
			.update(paymentSchedules)
			.set({
				paidAmount: scheduleUpdate.paidAmount,
				paidAt: scheduleUpdate.paidAt,
				status: scheduleUpdate.status,
				updatedAt: new Date(),
				updatedBy: input.userId,
			})
			.where(eq(paymentSchedules.id, input.paymentScheduleId));
	}

	return { id: created.id, bookingName: booking.name };
}

export async function convertSchedulePaymentTransition(
	tx: TransactionClient,
	input: Omit<ConvertScheduleInput, "idempotencyKey"> & PaymentActor,
) {
	const lockPlan = await tx.query.paymentSchedules.findFirst({
		where: and(
			eq(paymentSchedules.id, input.scheduleId),
			eq(paymentSchedules.organizationId, input.organizationId),
			isNull(paymentSchedules.deletedAt),
		),
	});
	if (!lockPlan) {
		throw new ORPCError("NOT_FOUND", {
			message: "Payment schedule not found",
		});
	}

	const booking = await getLockedBookingForReceipt(tx, {
		organizationId: input.organizationId,
		bookingId: lockPlan.bookingId,
	});
	if (!booking) {
		throw new ORPCError("NOT_FOUND", { message: "Booking not found" });
	}
	const linkedInvoice = await getLockedScheduleInvoiceForReceipt(tx, {
		organizationId: input.organizationId,
		bookingId: lockPlan.bookingId,
		paymentScheduleId: input.scheduleId,
	});
	const schedule = await getLockedScheduleForReceipt(tx, {
		organizationId: input.organizationId,
		bookingId: lockPlan.bookingId,
		paymentScheduleId: input.scheduleId,
	});
	if (!schedule) {
		throw new ORPCError("NOT_FOUND", {
			message: "Payment schedule not found",
		});
	}

	if (schedule.status === "partial" || schedule.status === "completed") {
		throw new ORPCError("CONFLICT", {
			message: SCHEDULE_ALREADY_CONVERTED_MESSAGE,
		});
	}

	const transition = buildSchedulePaymentTransition(
		schedule,
		input.amount,
		"Cancelled schedule cannot be converted",
	);
	const receivedDate = input.receivedDate;
	const [created] = await tx
		.insert(receivedAmounts)
		.values({
			organizationId: input.organizationId,
			bookingId: schedule.bookingId,
			amount: transition.amount,
			paymentMethod: input.paymentMethod,
			transactionReference: input.transactionReference ?? null,
			receivedDate,
			notes: input.notes ?? null,
			paymentScheduleId: input.scheduleId,
			invoiceId: linkedInvoice?.id ?? null,
			createdBy: input.userId,
			updatedBy: input.userId,
		})
		.returning({ id: receivedAmounts.id });
	if (!created) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Failed to create received payment",
		});
	}

	let receiptId: string | null = null;
	if (linkedInvoice) {
		if (linkedInvoice.status === "draft") {
			await tx
				.update(invoices)
				.set({
					status: "sent",
					updatedAt: new Date(),
					updatedBy: input.userId,
				})
				.where(eq(invoices.id, linkedInvoice.id));
		}
		const createdReceipt = await insertReceiptWithGeneratedNumber(tx, {
			organizationId: input.organizationId,
			bookingId: schedule.bookingId,
			values: {
				organizationId: input.organizationId,
				bookingId: schedule.bookingId,
				invoiceId: linkedInvoice.id,
				receivedAmountId: created.id,
				amount: transition.amount,
				paymentMethod: input.paymentMethod,
				receiptDate: receivedDate,
				notes: input.notes ?? null,
				createdBy: input.userId,
				updatedBy: input.userId,
			},
		});
		receiptId = createdReceipt.id;
		await updateInvoicePaymentStatus(tx, linkedInvoice.id, input.userId);
	}

	await tx
		.update(paymentSchedules)
		.set({
			paidAmount: transition.paidAmount,
			paidAt: transition.paidAt,
			status: transition.status,
			updatedAt: new Date(),
			updatedBy: input.userId,
		})
		.where(eq(paymentSchedules.id, input.scheduleId));
	await tx
		.update(bookings)
		.set({
			totalReceived: sql`${bookings.totalReceived} + ${transition.amount}`,
			updatedAt: new Date(),
			updatedBy: input.userId,
		})
		.where(eq(bookings.id, schedule.bookingId));

	return {
		receivedId: created.id,
		scheduleId: input.scheduleId,
		receiptId,
		created: true,
		bookingName: booking.name,
		schedule,
		paidAmount: transition.paidAmount,
		scheduleStatus: transition.status,
	};
}
