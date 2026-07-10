import { ORPCError } from "@orpc/server";
import {
	and,
	bookings,
	type db,
	eq,
	invoices,
	isNull,
	paymentSchedules,
	receipts,
	sql,
} from "@repo/database";

/**
 * Financial transitions acquire rows in this order:
 * booking -> invoice -> schedule -> received payment -> receipt.
 *
 * Read-only lookups may happen before the transaction to discover IDs, but every
 * decision that writes one of these records must use the value re-read after its
 * lock. Keeping schedule after invoice preserves the established receipt order.
 */
type InvoiceLockTransaction = Pick<typeof db, "execute" | "query">;

interface InvoiceReceiptContext {
	organizationId: string;
	bookingId: string;
}

export async function getLockedBookingForReceipt(
	tx: InvoiceLockTransaction,
	{
		organizationId,
		bookingId,
	}: {
		organizationId: string;
		bookingId: string;
	},
) {
	await tx.execute(sql`
		SELECT ${bookings.id}
		FROM ${bookings}
		WHERE ${bookings.id} = ${bookingId}
			AND ${bookings.organizationId} = ${organizationId}
			AND ${bookings.deletedAt} IS NULL
		FOR UPDATE
	`);

	return tx.query.bookings.findFirst({
		where: and(
			eq(bookings.id, bookingId),
			eq(bookings.organizationId, organizationId),
			isNull(bookings.deletedAt),
		),
	});
}

export async function getLockedInvoiceForReceipt(
	tx: InvoiceLockTransaction,
	{
		organizationId,
		bookingId,
		invoiceId,
		allowCancelled = false,
	}: InvoiceReceiptContext & { invoiceId: string; allowCancelled?: boolean },
) {
	await tx.execute(sql`
		SELECT ${invoices.id}
		FROM ${invoices}
		WHERE ${invoices.id} = ${invoiceId}
			AND ${invoices.organizationId} = ${organizationId}
			AND ${invoices.bookingId} = ${bookingId}
			AND ${invoices.deletedAt} IS NULL
		FOR UPDATE
	`);

	const invoice = await tx.query.invoices.findFirst({
		where: and(
			eq(invoices.id, invoiceId),
			eq(invoices.organizationId, organizationId),
			eq(invoices.bookingId, bookingId),
			isNull(invoices.deletedAt),
		),
	});

	if (invoice?.status === "cancelled" && !allowCancelled) {
		throw new ORPCError("CONFLICT", {
			message: "Cannot issue a receipt for a cancelled invoice",
		});
	}

	return invoice ?? null;
}

export async function getLockedReceiptForVoid(
	tx: InvoiceLockTransaction,
	{
		organizationId,
		receiptId,
	}: {
		organizationId: string;
		receiptId: string;
	},
) {
	await tx.execute(sql`
		SELECT ${receipts.id}
		FROM ${receipts}
		WHERE ${receipts.id} = ${receiptId}
			AND ${receipts.organizationId} = ${organizationId}
			AND ${receipts.deletedAt} IS NULL
		FOR UPDATE
	`);

	return tx.query.receipts.findFirst({
		where: and(
			eq(receipts.id, receiptId),
			eq(receipts.organizationId, organizationId),
			isNull(receipts.deletedAt),
		),
	});
}

export async function getLockedScheduleInvoiceForReceipt(
	tx: InvoiceLockTransaction,
	{
		organizationId,
		bookingId,
		paymentScheduleId,
	}: InvoiceReceiptContext & { paymentScheduleId: string },
) {
	const linked = await tx.query.invoices.findFirst({
		where: and(
			eq(invoices.paymentScheduleId, paymentScheduleId),
			eq(invoices.organizationId, organizationId),
			eq(invoices.bookingId, bookingId),
			isNull(invoices.deletedAt),
		),
		columns: { id: true },
	});

	if (!linked) {
		return null;
	}

	return getLockedInvoiceForReceipt(tx, {
		organizationId,
		bookingId,
		invoiceId: linked.id,
	});
}

export async function getLockedScheduleForReceipt(
	tx: InvoiceLockTransaction,
	{
		organizationId,
		bookingId,
		paymentScheduleId,
	}: InvoiceReceiptContext & { paymentScheduleId: string },
) {
	await tx.execute(sql`
		SELECT ${paymentSchedules.id}
		FROM ${paymentSchedules}
		WHERE ${paymentSchedules.id} = ${paymentScheduleId}
			AND ${paymentSchedules.organizationId} = ${organizationId}
			AND ${paymentSchedules.bookingId} = ${bookingId}
			AND ${paymentSchedules.deletedAt} IS NULL
		FOR UPDATE
	`);

	return tx.query.paymentSchedules.findFirst({
		where: and(
			eq(paymentSchedules.id, paymentScheduleId),
			eq(paymentSchedules.organizationId, organizationId),
			eq(paymentSchedules.bookingId, bookingId),
			isNull(paymentSchedules.deletedAt),
		),
	});
}
