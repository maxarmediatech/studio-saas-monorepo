import {
	and,
	bookings,
	configurations,
	db,
	desc,
	eq,
	invoices,
	isNull,
	sql,
} from "@repo/database";
import { format } from "date-fns";

export {
	getInvalidTransitionMessage,
	type InvoiceStatus,
	isValidStatusTransition,
} from "./status-transitions";

export async function generateInvoiceNumber(
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
		throw new Error("Booking not found for invoice number generation");
	}

	const today = new Date();
	const dateStr = format(today, "yyMMdd");
	const baseNumber = `INV-${booking.referenceNumber}-${dateStr}`;

	const existing = await db.query.invoices.findFirst({
		where: and(
			eq(invoices.organizationId, orgId),
			sql`${invoices.invoiceNumber} LIKE ${baseNumber + "%"}`,
			isNull(invoices.deletedAt),
		),
		orderBy: desc(invoices.invoiceNumber),
		columns: { invoiceNumber: true },
	});

	if (!existing) return baseNumber;

	const match = existing.invoiceNumber.match(/-(\d+)$/);
	const nextSeq = match ? Number.parseInt(match[1], 10) + 1 : 1;
	return `${baseNumber}-${nextSeq}`;
}

export interface GstCalculation {
	gstRate: number;
	taxAmount: number;
	totalAmount: number;
}

export async function calculateGst(
	subtotal: number,
	orgId: string,
	discountAmount = 0,
): Promise<GstCalculation> {
	const config = await db.query.configurations.findFirst({
		where: and(
			eq(configurations.organizationId, orgId),
			eq(configurations.type, "gst_rate"),
			eq(configurations.key, "default"),
		),
		columns: { metadata: true },
	});

	const gstRate = (config?.metadata as { rate?: number } | null)?.rate ?? 18;
	const taxAmount = subtotal * (gstRate / 100);
	const totalAmount = subtotal + taxAmount - discountAmount;

	return {
		gstRate,
		taxAmount: Math.round(taxAmount * 100) / 100,
		totalAmount: Math.round(totalAmount * 100) / 100,
	};
}

export async function recalculateInvoiceTotals(
	invoiceId: string,
): Promise<{ subtotal: string; taxAmount: string; totalAmount: string }> {
	const invoice = await db.query.invoices.findFirst({
		where: eq(invoices.id, invoiceId),
		columns: { organizationId: true, discountAmount: true },
		with: {
			lineItems: {
				columns: { amount: true },
			},
		},
	});

	if (!invoice) {
		throw new Error("Invoice not found for recalculation");
	}

	const subtotal = invoice.lineItems.reduce(
		(sum, item) => sum + Number.parseFloat(item.amount),
		0,
	);

	const discountAmount = Number.parseFloat(invoice.discountAmount);
	const { taxAmount, totalAmount } = await calculateGst(
		subtotal,
		invoice.organizationId,
		discountAmount,
	);

	return {
		subtotal: subtotal.toFixed(2),
		taxAmount: taxAmount.toFixed(2),
		totalAmount: totalAmount.toFixed(2),
	};
}
