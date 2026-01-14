import { and, db, desc, eq, ilike, invoices, isNull, or } from "@repo/database";
import type { InvoiceSearchResult } from "../../types";
import { buildTextSearchCondition, extractIdentifier } from "../search-utils";

export async function searchInvoices(
	organizationId: string,
	query: string,
	limit: number,
): Promise<InvoiceSearchResult[]> {
	const conditions = [
		eq(invoices.organizationId, organizationId),
		isNull(invoices.deletedAt),
	];

	// Text search on invoice number and notes
	const textSearch = buildTextSearchCondition(
		query,
		invoices.invoiceNumber,
		invoices.notes,
	);

	// Identifier pattern matching (e.g., "INV-2024-001")
	const { pattern, number } = extractIdentifier(query);

	if (pattern) {
		conditions.push(
			or(
				eq(invoices.invoiceNumber, pattern),
				ilike(invoices.invoiceNumber, `%${pattern}%`),
			)!,
		);
	} else if (number) {
		conditions.push(ilike(invoices.invoiceNumber, `%${number}%`));
	} else if (textSearch) {
		conditions.push(textSearch);
	}

	const results = await db
		.select({
			id: invoices.id,
			invoiceNumber: invoices.invoiceNumber,
			status: invoices.status,
			totalAmount: invoices.totalAmount,
			bookingId: invoices.bookingId,
		})
		.from(invoices)
		.where(and(...conditions))
		.orderBy(desc(invoices.createdAt))
		.limit(limit);

	return results;
}
