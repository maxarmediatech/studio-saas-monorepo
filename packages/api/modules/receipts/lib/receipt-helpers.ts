import { ORPCError } from "@orpc/server";
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
import { centsToMoney, moneyToCents } from "../../studio/lib/money";
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

type Tx = Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];
type DbOrTx = typeof db | Tx;

function getDateOnlyString(value: unknown): string | null {
	if (!value) return null;
	if (typeof value === "string") return value;
	if (value instanceof Date) return value.toISOString().slice(0, 10);
	return null;
}

export async function updateInvoicePaymentStatus(
	dbOrTx: DbOrTx,
	invoiceId: string,
	userId: string,
): Promise<void> {
	const invoice = await dbOrTx.query.invoices.findFirst({
		where: and(eq(invoices.id, invoiceId), isNull(invoices.deletedAt)),
		columns: {
			totalAmount: true,
			status: true,
			paidAt: true,
			dueDate: true,
		},
	});

	if (!invoice) {
		throw new ORPCError("NOT_FOUND", {
			message: "Invoice not found",
		});
	}

	const currentStatus = invoice.status as InvoiceStatus;
	if (currentStatus === "cancelled") {
		throw new ORPCError("CONFLICT", {
			message: "Cannot record payments for a cancelled invoice",
		});
	}
	if (currentStatus === "draft") {
		throw new ORPCError("CONFLICT", {
			message: "Invoice must be sent before recording payments",
		});
	}

	const receiptsForInvoice = await dbOrTx.query.receipts.findMany({
		where: and(
			eq(receipts.invoiceId, invoiceId),
			isNull(receipts.deletedAt),
		),
		columns: { amount: true },
	});

	const totalPaidCents = receiptsForInvoice.reduce(
		(sum, r) => sum + moneyToCents(r.amount),
		0,
	);
	const invoiceTotalCents = moneyToCents(invoice.totalAmount);

	if (totalPaidCents > invoiceTotalCents) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Payment total exceeds invoice total",
		});
	}

	const today = new Date().toISOString().slice(0, 10);
	const dueDate = getDateOnlyString(invoice.dueDate);
	const isPastDue = !!dueDate && dueDate < today;

	let baseStatus: InvoiceStatus =
		currentStatus === "paid" || currentStatus === "partial"
			? "sent"
			: currentStatus;
	if (isPastDue) {
		baseStatus = "overdue";
	}

	const { newStatus, isPaid } = determineInvoiceStatus(
		totalPaidCents,
		invoiceTotalCents,
		baseStatus,
	);

	await dbOrTx
		.update(invoices)
		.set({
			paidAmount: centsToMoney(totalPaidCents),
			status: newStatus,
			paidAt: isPaid ? (invoice.paidAt ?? new Date()) : null,
			updatedAt: new Date(),
			updatedBy: userId,
		})
		.where(eq(invoices.id, invoiceId));
}
