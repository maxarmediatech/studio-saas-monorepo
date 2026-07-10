import { ORPCError } from "@orpc/server";
import {
	and,
	bookings,
	type db,
	eq,
	invoices,
	isNull,
	sql,
} from "@repo/database";

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
	}: InvoiceReceiptContext & { invoiceId: string },
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

	if (invoice?.status === "cancelled") {
		throw new ORPCError("CONFLICT", {
			message: "Cannot issue a receipt for a cancelled invoice",
		});
	}

	return invoice ?? null;
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
