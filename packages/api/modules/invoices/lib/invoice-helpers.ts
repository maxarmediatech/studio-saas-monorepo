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
import { centsToMoney, moneyToCents } from "../../studio/lib/money";
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
	taxAmount: string;
	totalAmount: string;
}

type Tx = Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];
type DbOrTx = typeof db | Tx;

export async function calculateGst(
	subtotal: string,
	orgId: string,
	discountAmount = "0",
): Promise<GstCalculation> {
	const config = await db.query.configurations.findFirst({
		where: and(
			eq(configurations.organizationId, orgId),
			eq(configurations.type, "gst_rate"),
			eq(configurations.key, "default"),
		),
		columns: { metadata: true },
	});

	const rateValue = (config?.metadata as { rate?: unknown } | null)?.rate;
	const gstRateRaw = Number(rateValue);
	const gstRate = Number.isFinite(gstRateRaw) ? gstRateRaw : 18;

	const subtotalCents = moneyToCents(subtotal);
	const discountCents = moneyToCents(discountAmount);

	if (discountCents > subtotalCents) {
		throw new Error("Discount cannot exceed subtotal");
	}

	const taxableCents = subtotalCents - discountCents;
	const taxCents = Math.round((taxableCents * gstRate) / 100);
	const totalCents = taxableCents + taxCents;

	return {
		gstRate,
		taxAmount: centsToMoney(taxCents),
		totalAmount: centsToMoney(totalCents),
	};
}

export async function recalculateInvoiceTotals(
	dbOrTx: DbOrTx,
	invoiceId: string,
): Promise<{ subtotal: string; taxAmount: string; totalAmount: string }> {
	const invoice = await dbOrTx.query.invoices.findFirst({
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
		(sum, item) => sum + moneyToCents(item.amount),
		0,
	);

	const { taxAmount, totalAmount } = await calculateGst(
		centsToMoney(subtotal),
		invoice.organizationId,
		invoice.discountAmount,
	);

	return {
		subtotal: centsToMoney(subtotal),
		taxAmount,
		totalAmount,
	};
}
