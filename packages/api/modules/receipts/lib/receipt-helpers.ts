import {
	and,
	bookings,
	db,
	desc,
	eq,
	invoices,
	isNull,
	receipts,
	sql,
} from "@repo/database";
import {
	buildReceiptNumber,
	determineInvoiceStatus,
	getNextReceiptNumber,
	type InvoiceStatus,
} from "./receipt-utils";

export {
	buildReceiptNumber,
	determineInvoiceStatus,
	getNextReceiptNumber,
	type InvoiceStatus,
	type InvoiceStatusResult,
} from "./receipt-utils";

export async function generateReceiptNumber(
	bookingId: string,
	orgId: string,
): Promise<string> {
	const booking = await db.query.bookings.findFirst({
		where: and(
			eq(bookings.id, bookingId),
			eq(bookings.organizationId, orgId),
		),
		columns: { referenceNumber: true },
	});

	if (!booking) {
		throw new Error("Booking not found for receipt number generation");
	}

	const baseNumber = buildReceiptNumber(booking.referenceNumber, new Date());

	const existing = await db.query.receipts.findFirst({
		where: and(
			eq(receipts.organizationId, orgId),
			sql`${receipts.receiptNumber} LIKE ${baseNumber + "%"}`,
			isNull(receipts.deletedAt),
		),
		orderBy: desc(receipts.receiptNumber),
		columns: { receiptNumber: true },
	});

	return getNextReceiptNumber(baseNumber, existing?.receiptNumber ?? null);
}

export async function updateInvoicePaymentStatus(
	invoiceId: string,
	userId: string,
): Promise<void> {
	const invoice = await db.query.invoices.findFirst({
		where: eq(invoices.id, invoiceId),
		columns: {
			totalAmount: true,
			paidAmount: true,
			status: true,
			paidAt: true,
		},
	});

	if (!invoice) {
		throw new Error("Invoice not found for status update");
	}

	const receiptsForInvoice = await db.query.receipts.findMany({
		where: and(
			eq(receipts.invoiceId, invoiceId),
			isNull(receipts.deletedAt),
		),
		columns: { amount: true },
	});

	const totalPaid = receiptsForInvoice.reduce(
		(sum, r) => sum + Number.parseFloat(r.amount),
		0,
	);

	const invoiceTotal = Number.parseFloat(invoice.totalAmount);
	const { newStatus, isPaid } = determineInvoiceStatus(
		totalPaid,
		invoiceTotal,
		invoice.status as InvoiceStatus,
	);

	await db
		.update(invoices)
		.set({
			paidAmount: totalPaid.toFixed(2),
			status: newStatus,
			paidAt: isPaid ? new Date() : invoice.paidAt,
			updatedAt: new Date(),
			updatedBy: userId,
		})
		.where(eq(invoices.id, invoiceId));
}
