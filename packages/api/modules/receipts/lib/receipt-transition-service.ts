import { ORPCError } from "@orpc/server";
import { and, eq, isNull, receipts, receivedAmounts } from "@repo/database";
import type { TransactionClient } from "../../studio/lib/transactions";
import { getLockedReceivedPayment } from "../../studio-payments/lib/received-payment-lock";
import {
	getLockedBookingForReceipt,
	getLockedInvoiceForReceipt,
	getLockedReceiptForVoid,
	getLockedReceiptHistoryForPayment,
	getLockedScheduleForReceipt,
} from "./locked-invoice-for-receipt";
import {
	generateReceiptNumber,
	updateInvoicePaymentStatus,
} from "./receipt-helpers";

const MAX_RECEIPT_INSERT_ATTEMPTS = 5;

function isReceiptNumberConflict(error: unknown): boolean {
	const code = (error as { code?: string })?.code;
	const constraint = (error as { constraint?: string })?.constraint;

	return (
		code === "23505" ||
		constraint === "receipts_org_number_idx" ||
		(error instanceof Error &&
			error.message.toLowerCase().includes("receipts_org_number_idx"))
	);
}

interface IssueReceiptInput {
	organizationId: string;
	userId: string;
	receivedAmountId: string;
	expectedBookingId?: string;
	expectedInvoiceId?: string;
}

export async function insertReceiptWithGeneratedNumber(
	tx: TransactionClient,
	input: {
		organizationId: string;
		bookingId: string;
		values: Omit<typeof receipts.$inferInsert, "receiptNumber">;
	},
) {
	for (let attempt = 0; attempt < MAX_RECEIPT_INSERT_ATTEMPTS; attempt++) {
		try {
			return await tx.transaction(async (receiptTx) => {
				const receiptNumber = await generateReceiptNumber(
					input.bookingId,
					input.organizationId,
					receiptTx,
				);
				const [created] = await receiptTx
					.insert(receipts)
					.values({ ...input.values, receiptNumber })
					.returning({
						id: receipts.id,
						receiptNumber: receipts.receiptNumber,
					});
				if (!created) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Failed to create receipt",
					});
				}
				return created;
			});
		} catch (error) {
			if (
				isReceiptNumberConflict(error) &&
				attempt < MAX_RECEIPT_INSERT_ATTEMPTS - 1
			) {
				continue;
			}
			throw error;
		}
	}

	throw new ORPCError("INTERNAL_SERVER_ERROR", {
		message: "Failed to create receipt",
	});
}

export async function issueReceiptForReceivedPayment(
	tx: TransactionClient,
	input: IssueReceiptInput,
) {
	const lockPlan = await tx.query.receivedAmounts.findFirst({
		where: and(
			eq(receivedAmounts.id, input.receivedAmountId),
			eq(receivedAmounts.organizationId, input.organizationId),
			isNull(receivedAmounts.deletedAt),
		),
		columns: { bookingId: true, invoiceId: true, paymentScheduleId: true },
	});

	if (!lockPlan) {
		throw new ORPCError("NOT_FOUND", {
			message: "Received payment not found",
		});
	}

	const bookingId = input.expectedBookingId ?? lockPlan.bookingId;
	const invoiceId = input.expectedInvoiceId ?? lockPlan.invoiceId;
	const booking = await getLockedBookingForReceipt(tx, {
		organizationId: input.organizationId,
		bookingId,
	});

	if (!booking) {
		throw new ORPCError("NOT_FOUND", { message: "Booking not found" });
	}

	const invoice = invoiceId
		? await getLockedInvoiceForReceipt(tx, {
				organizationId: input.organizationId,
				bookingId,
				invoiceId,
			})
		: null;

	if (invoiceId && !invoice) {
		throw new ORPCError("NOT_FOUND", {
			message: "Invoice not found or does not belong to this booking",
		});
	}

	const schedule = lockPlan.paymentScheduleId
		? await getLockedScheduleForReceipt(tx, {
				organizationId: input.organizationId,
				bookingId,
				paymentScheduleId: lockPlan.paymentScheduleId,
			})
		: null;
	if (lockPlan.paymentScheduleId && !schedule) {
		throw new ORPCError("CONFLICT", {
			message: "Payment schedule no longer exists for this payment",
		});
	}
	const received = await getLockedReceivedPayment(tx, {
		organizationId: input.organizationId,
		receivedAmountId: input.receivedAmountId,
	});

	if (!received) {
		throw new ORPCError("NOT_FOUND", {
			message: "Received payment not found",
		});
	}

	if (
		received.bookingId !== bookingId ||
		received.invoiceId !== (invoiceId ?? null) ||
		received.paymentScheduleId !== lockPlan.paymentScheduleId
	) {
		throw new ORPCError("CONFLICT", {
			message: input.expectedBookingId
				? "Received payment does not match the supplied booking or invoice"
				: "Received payment relationships changed during receipt generation. Retry the request.",
		});
	}
	if (invoice && invoice.paymentScheduleId !== received.paymentScheduleId) {
		throw new ORPCError("CONFLICT", {
			message:
				"Payment and invoice belong to different payment schedules",
		});
	}

	const receiptHistory = await getLockedReceiptHistoryForPayment(tx, {
		organizationId: input.organizationId,
		receivedAmountId: received.id,
	});
	const voidedReceipt = receiptHistory.find((receipt) => receipt.deletedAt);
	if (voidedReceipt) {
		throw new ORPCError("CONFLICT", {
			message:
				"A receipt for this payment was voided and cannot be reissued",
		});
	}
	const existingReceipt = receiptHistory.find(
		(receipt) => !receipt.deletedAt,
	);

	if (existingReceipt) {
		return {
			id: existingReceipt.id,
			receiptNumber: existingReceipt.receiptNumber,
			created: false,
			booking,
			invoice,
			schedule,
			received,
		};
	}

	const createdReceipt = await insertReceiptWithGeneratedNumber(tx, {
		organizationId: input.organizationId,
		bookingId: received.bookingId,
		values: {
			organizationId: input.organizationId,
			bookingId: received.bookingId,
			invoiceId: received.invoiceId ?? null,
			receivedAmountId: received.id,
			amount: received.amount,
			paymentMethod: received.paymentMethod,
			receiptDate: received.receivedDate,
			notes: received.notes,
			createdBy: input.userId,
			updatedBy: input.userId,
		},
	});

	if (received.invoiceId) {
		await updateInvoicePaymentStatus(tx, received.invoiceId, input.userId);
	}

	return {
		...createdReceipt,
		created: true,
		booking,
		invoice,
		schedule,
		received,
	};
}

interface VoidReceiptInput {
	organizationId: string;
	userId: string;
	receiptId: string;
	reason?: string;
}

export async function voidReceiptTransition(
	tx: TransactionClient,
	input: VoidReceiptInput,
) {
	const lockPlan = await tx.query.receipts.findFirst({
		where: and(
			eq(receipts.id, input.receiptId),
			eq(receipts.organizationId, input.organizationId),
		),
	});

	if (!lockPlan) {
		throw new ORPCError("NOT_FOUND", { message: "Receipt not found" });
	}
	if (lockPlan.deletedAt) {
		return {
			receipt: lockPlan,
			bookingName: "Unknown Booking",
			voided: false,
		};
	}
	const paymentPlan = lockPlan.receivedAmountId
		? await tx.query.receivedAmounts.findFirst({
				where: and(
					eq(receivedAmounts.id, lockPlan.receivedAmountId),
					eq(receivedAmounts.organizationId, input.organizationId),
					isNull(receivedAmounts.deletedAt),
				),
				columns: {
					bookingId: true,
					invoiceId: true,
					paymentScheduleId: true,
				},
			})
		: null;
	if (lockPlan.receivedAmountId && !paymentPlan) {
		throw new ORPCError("CONFLICT", {
			message: "Receipt payment no longer exists",
		});
	}

	const booking = await getLockedBookingForReceipt(tx, {
		organizationId: input.organizationId,
		bookingId: lockPlan.bookingId,
	});
	if (!booking) {
		throw new ORPCError("NOT_FOUND", { message: "Booking not found" });
	}

	const invoice = lockPlan.invoiceId
		? await getLockedInvoiceForReceipt(tx, {
				organizationId: input.organizationId,
				bookingId: lockPlan.bookingId,
				invoiceId: lockPlan.invoiceId,
				allowCancelled: true,
			})
		: null;
	if (lockPlan.invoiceId && !invoice) {
		throw new ORPCError("NOT_FOUND", {
			message: "Invoice not found or does not belong to this booking",
		});
	}

	const schedule = paymentPlan?.paymentScheduleId
		? await getLockedScheduleForReceipt(tx, {
				organizationId: input.organizationId,
				bookingId: lockPlan.bookingId,
				paymentScheduleId: paymentPlan.paymentScheduleId,
			})
		: null;
	if (paymentPlan?.paymentScheduleId && !schedule) {
		throw new ORPCError("CONFLICT", {
			message: "Payment schedule no longer exists for this payment",
		});
	}
	if (lockPlan.receivedAmountId) {
		const received = await getLockedReceivedPayment(tx, {
			organizationId: input.organizationId,
			receivedAmountId: lockPlan.receivedAmountId,
		});
		if (!received) {
			throw new ORPCError("CONFLICT", {
				message: "Receipt payment no longer exists",
			});
		}
		if (
			received.bookingId !== lockPlan.bookingId ||
			received.invoiceId !== lockPlan.invoiceId ||
			received.paymentScheduleId !== paymentPlan?.paymentScheduleId
		) {
			throw new ORPCError("CONFLICT", {
				message:
					"Receipt payment relationships changed. Retry the request.",
			});
		}
		if (
			invoice &&
			invoice.paymentScheduleId !== received.paymentScheduleId
		) {
			throw new ORPCError("CONFLICT", {
				message:
					"Payment and invoice belong to different payment schedules",
			});
		}
	}

	const receipt = await getLockedReceiptForVoid(tx, {
		organizationId: input.organizationId,
		receiptId: input.receiptId,
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

	const voidNote = input.reason ? `[Voided: ${input.reason}]` : null;
	await tx
		.update(receipts)
		.set({
			deletedAt: new Date(),
			deletedBy: input.userId,
			updatedAt: new Date(),
			updatedBy: input.userId,
			...(voidNote
				? {
						notes: receipt.notes
							? `${receipt.notes}\n\n${voidNote}`
							: voidNote,
					}
				: {}),
		})
		.where(eq(receipts.id, input.receiptId));

	if (receipt.invoiceId) {
		await updateInvoicePaymentStatus(tx, receipt.invoiceId, input.userId, {
			allowCancelled: true,
		});
	}

	return { receipt, bookingName: booking.name, voided: true };
}
