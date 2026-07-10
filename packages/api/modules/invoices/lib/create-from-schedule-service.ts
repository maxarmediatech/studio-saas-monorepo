import { ORPCError } from "@orpc/server";
import { invoiceLineItems, invoices } from "@repo/database";
import { format } from "date-fns";
import {
	getLockedBookingForReceipt,
	getLockedScheduleForReceipt,
	getLockedScheduleInvoiceForReceipt,
} from "../../receipts/lib/locked-invoice-for-receipt";
import { centsToMoney, moneyToCents } from "../../studio/lib/money";
import type { TransactionClient } from "../../studio/lib/transactions";
import type { CreateInvoiceFromScheduleInput } from "../../studio/schemas/invoice";
import {
	calculateGst,
	generateInvoiceNumber,
	type TaxType,
} from "./invoice-helpers";

export async function createInvoiceFromScheduleTransition(
	tx: TransactionClient,
	input: CreateInvoiceFromScheduleInput & {
		organizationId: string;
		userId: string;
		bookingId: string;
	},
) {
	const booking = await getLockedBookingForReceipt(tx, {
		organizationId: input.organizationId,
		bookingId: input.bookingId,
	});
	if (!booking) {
		throw new ORPCError("NOT_FOUND", { message: "Booking not found" });
	}

	const existingInvoice = await getLockedScheduleInvoiceForReceipt(tx, {
		organizationId: input.organizationId,
		bookingId: input.bookingId,
		paymentScheduleId: input.paymentScheduleId,
	});
	if (existingInvoice) {
		throw new ORPCError("CONFLICT", {
			message: `An invoice (${existingInvoice.invoiceNumber}) already exists for this payment schedule`,
		});
	}

	const schedule = await getLockedScheduleForReceipt(tx, {
		organizationId: input.organizationId,
		bookingId: input.bookingId,
		paymentScheduleId: input.paymentScheduleId,
	});
	if (!schedule) {
		throw new ORPCError("NOT_FOUND", {
			message: "Payment schedule not found",
		});
	}
	if (["partial", "completed", "cancelled"].includes(schedule.status)) {
		throw new ORPCError("CONFLICT", {
			message:
				"Invoices cannot be generated from partially paid, completed, or cancelled schedules",
		});
	}

	const subtotalCents = moneyToCents(schedule.amount);
	const taxType = (input.taxType ??
		(schedule.taxType as TaxType) ??
		"exclusive") as TaxType;
	const { taxAmount, totalAmount } = await calculateGst(
		centsToMoney(subtotalCents),
		input.organizationId,
		"0.00",
		taxType,
	);
	const invoiceNumber = await generateInvoiceNumber(
		schedule.bookingId,
		input.organizationId,
	);
	const [created] = await tx
		.insert(invoices)
		.values({
			organizationId: input.organizationId,
			bookingId: schedule.bookingId,
			paymentScheduleId: input.paymentScheduleId,
			invoiceNumber,
			status: "draft",
			issueDate: input.issueDate ?? format(new Date(), "yyyy-MM-dd"),
			dueDate: input.dueDate ?? schedule.dueDate,
			subtotal: centsToMoney(subtotalCents),
			taxAmount,
			discountAmount: "0.00",
			taxType,
			totalAmount,
			paidAmount: "0.00",
			notes: input.notes ?? null,
			terms: input.terms ?? null,
			createdBy: input.userId,
			updatedBy: input.userId,
		})
		.returning({ id: invoices.id });
	if (!created) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Failed to create invoice",
		});
	}

	await tx.insert(invoiceLineItems).values({
		invoiceId: created.id,
		description: schedule.name,
		type: "milestone",
		quantity: null,
		unitPrice: null,
		amount: centsToMoney(moneyToCents(schedule.amount)),
		sortOrder: 0,
	});

	return {
		id: created.id,
		invoiceNumber,
		totalAmount,
		schedule,
		bookingName: booking.name,
	};
}
