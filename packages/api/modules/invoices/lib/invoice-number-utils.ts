import { format } from "date-fns";

export function buildInvoiceNumber(
	bookingReferenceNumber: string,
	date: Date,
): string {
	const dateStr = format(date, "yyMMdd");
	return `INV-${bookingReferenceNumber}-${dateStr}`;
}

export function getNextInvoiceNumber(
	baseNumber: string,
	existingInvoiceNumber: string | null,
): string {
	if (!existingInvoiceNumber) {
		return baseNumber;
	}

	if (existingInvoiceNumber === baseNumber) {
		return `${baseNumber}-1`;
	}

	const sequencePattern = new RegExp(`^${escapeRegex(baseNumber)}-(\\d+)$`);
	const match = existingInvoiceNumber.match(sequencePattern);

	if (match) {
		const nextSeq = Number.parseInt(match[1], 10) + 1;
		return `${baseNumber}-${nextSeq}`;
	}

	return `${baseNumber}-1`;
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
