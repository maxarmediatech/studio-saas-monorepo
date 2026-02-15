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
import {
	buildInvoiceNumber,
	getNextInvoiceNumber,
} from "./invoice-number-utils";

export {
	getInvalidTransitionMessage,
	type InvoiceStatus,
	isValidStatusTransition,
} from "./status-transitions";
export { buildInvoiceNumber, getNextInvoiceNumber } from "./invoice-number-utils";

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
	const baseNumber = buildInvoiceNumber(booking.referenceNumber, today);

	const existing = await db.query.invoices.findFirst({
		where: and(
			eq(invoices.organizationId, orgId),
			sql`${invoices.invoiceNumber} LIKE ${baseNumber + "%"}`,
			isNull(invoices.deletedAt),
		),
		orderBy: desc(invoices.invoiceNumber),
		columns: { invoiceNumber: true },
	});

	return getNextInvoiceNumber(baseNumber, existing?.invoiceNumber ?? null);
}

export interface GstCalculation {
	gstRate: number;
	taxAmount: string;
	totalAmount: string;
}

type Tx = Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];
type DbOrTx = typeof db | Tx;

export type TaxType = "exclusive" | "inclusive" | "no_gst";

interface GstConfig {
	gstRate: number;
	defaultTaxType: TaxType;
}

export async function getGstConfig(orgId: string): Promise<GstConfig> {
	const config = await db.query.configurations.findFirst({
		where: and(
			eq(configurations.organizationId, orgId),
			eq(configurations.type, "gst_rate"),
			eq(configurations.key, "default"),
		),
		columns: { metadata: true },
	});

	const metadata = config?.metadata as {
		rate?: unknown;
		defaultTaxType?: unknown;
	} | null;

	const rateValue = metadata?.rate;
	const gstRateRaw = Number(rateValue);
	const gstRate = Number.isFinite(gstRateRaw) ? gstRateRaw : 18;

	const rawTaxType = metadata?.defaultTaxType;
	const defaultTaxType: TaxType =
		rawTaxType === "inclusive" || rawTaxType === "no_gst"
			? rawTaxType
			: "exclusive";

	return { gstRate, defaultTaxType };
}

export async function calculateGst(
	subtotal: string,
	orgId: string,
	discountAmount = "0",
	taxType?: TaxType,
): Promise<GstCalculation> {
	const { gstRate, defaultTaxType } = await getGstConfig(orgId);
	const effectiveTaxType = taxType ?? defaultTaxType;

	const subtotalCents = moneyToCents(subtotal);
	const discountCents = moneyToCents(discountAmount);

	if (discountCents > subtotalCents) {
		throw new Error("Discount cannot exceed subtotal");
	}

	const taxableCents = subtotalCents - discountCents;

	let taxCents: number;
	let totalCents: number;

	switch (effectiveTaxType) {
		case "inclusive":
			// Tax is already included in the price — extract it
			taxCents = Math.round((taxableCents * gstRate) / (100 + gstRate));
			totalCents = taxableCents;
			break;
		case "no_gst":
			taxCents = 0;
			totalCents = taxableCents;
			break;
		case "exclusive":
		default:
			// Tax added on top (existing behavior)
			taxCents = Math.round((taxableCents * gstRate) / 100);
			totalCents = taxableCents + taxCents;
			break;
	}

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
		columns: { organizationId: true, discountAmount: true, taxType: true },
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
		invoice.taxType as TaxType,
	);

	return {
		subtotal: centsToMoney(subtotal),
		taxAmount,
		totalAmount,
	};
}
