import { format } from "date-fns";

export function buildReceiptNumber(
	bookingReferenceNumber: string,
	date: Date,
): string {
	const dateStr = format(date, "yyMMdd");
	return `REC-${bookingReferenceNumber}-${dateStr}`;
}

export function getNextReceiptNumber(
	baseNumber: string,
	existingReceiptNumber: string | null,
): string {
	if (!existingReceiptNumber) return baseNumber;

	if (existingReceiptNumber === baseNumber) {
		return `${baseNumber}-1`;
	}

	const sequencePattern = new RegExp(`^${escapeRegex(baseNumber)}-(\\d+)$`);
	const match = existingReceiptNumber.match(sequencePattern);

	if (match) {
		const nextSeq = Number.parseInt(match[1], 10) + 1;
		return `${baseNumber}-${nextSeq}`;
	}

	return `${baseNumber}-1`;
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type InvoiceStatus =
	| "draft"
	| "sent"
	| "paid"
	| "partial"
	| "overdue"
	| "cancelled";

export interface InvoiceStatusResult {
	newStatus: InvoiceStatus;
	isPaid: boolean;
}

export function determineInvoiceStatus(
	totalPaid: number,
	invoiceTotal: number,
	currentStatus: InvoiceStatus,
): InvoiceStatusResult {
	if (totalPaid >= invoiceTotal) {
		return { newStatus: "paid", isPaid: true };
	}
	if (totalPaid > 0) {
		return { newStatus: "partial", isPaid: false };
	}
	return { newStatus: currentStatus, isPaid: false };
}
