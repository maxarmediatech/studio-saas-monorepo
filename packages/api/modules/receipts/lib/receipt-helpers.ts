import { ORPCError } from "@orpc/server";
import {
	and,
	bookings,
	db,
	eq,
	invoices,
	isNull,
	receipts,
} from "@repo/database";
import {
	advanceDocumentSequenceFloor,
	allocateDocumentNumber,
} from "../../financial-documents/lib/document-number-service";
import { centsToMoney, moneyToCents } from "../../studio/lib/money";
import {
	buildReceiptNumber,
	determineInvoiceStatus,
	type InvoiceStatus,
} from "./receipt-utils";

export {
	buildReceiptNumber,
	determineInvoiceStatus,
	getNextReceiptNumber,
	type InvoiceStatus,
	type InvoiceStatusResult,
} from "./receipt-utils";

type Tx = Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];
type DbOrTx = typeof db | Tx;

async function getReceiptNumberBase(
	bookingId: string,
	orgId: string,
	dbOrTx: DbOrTx,
): Promise<string> {
	const booking = await dbOrTx.query.bookings.findFirst({
		where: and(
			eq(bookings.id, bookingId),
			eq(bookings.organizationId, orgId),
		),
		columns: { referenceNumber: true },
	});

	if (!booking) {
		throw new Error("Booking not found for receipt number generation");
	}

	return buildReceiptNumber(booking.referenceNumber, new Date());
}

export async function generateReceiptNumber(
	bookingId: string,
	orgId: string,
	dbOrTx: DbOrTx = db,
): Promise<string> {
	const baseNumber = await getReceiptNumberBase(bookingId, orgId, dbOrTx);

	return dbOrTx.transaction((tx) =>
		allocateDocumentNumber(tx, {
			organizationId: orgId,
			documentType: "receipt",
			baseNumber,
		}),
	);
}

export async function advanceReceiptNumberSequenceFloor(
	bookingId: string,
	orgId: string,
	tx: Tx,
): Promise<number> {
	const baseNumber = await getReceiptNumberBase(bookingId, orgId, tx);
	return advanceDocumentSequenceFloor(tx, {
		organizationId: orgId,
		documentType: "receipt",
		baseNumber,
	});
}

function getDateOnlyString(value: unknown): string | null {
	if (!value) {
		return null;
	}
	if (typeof value === "string") {
		return value;
	}
	if (value instanceof Date) {
		return value.toISOString().slice(0, 10);
	}
	return null;
}

export async function updateInvoicePaymentStatus(
	dbOrTx: DbOrTx,
	invoiceId: string,
	userId: string,
	{ allowCancelled = false }: { allowCancelled?: boolean } = {},
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
	if (currentStatus === "cancelled" && !allowCancelled) {
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
	const status = currentStatus === "cancelled" ? "cancelled" : newStatus;

	await dbOrTx
		.update(invoices)
		.set({
			paidAmount: centsToMoney(totalPaidCents),
			status,
			paidAt: isPaid ? (invoice.paidAt ?? new Date()) : null,
			updatedAt: new Date(),
			updatedBy: userId,
		})
		.where(eq(invoices.id, invoiceId));
}
