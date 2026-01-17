import { and, bookings, db, desc, eq, ilike, isNull, or } from "@repo/database";
import type { BookingSearchResult } from "../../types";
import { buildTextSearchCondition, extractIdentifier } from "../search-utils";

export async function searchBookings(
	organizationId: string,
	query: string,
	limit: number,
): Promise<BookingSearchResult[]> {
	const conditions = [
		eq(bookings.organizationId, organizationId),
		isNull(bookings.deletedAt),
	];

	// Text search on name and reference number
	const textSearch = buildTextSearchCondition(
		query,
		bookings.name,
		bookings.referenceNumber,
	);

	// Identifier pattern matching (e.g., "BK-123")
	const { pattern, number } = extractIdentifier(query);

	if (pattern) {
		// Exact match on pattern takes priority
		conditions.push(
			or(
				eq(bookings.referenceNumber, pattern),
				ilike(bookings.referenceNumber, `%${pattern}%`),
			)!,
		);
	} else if (number) {
		// Search by number within reference
		conditions.push(ilike(bookings.referenceNumber, `%${number}%`));
	} else if (textSearch) {
		conditions.push(textSearch);
	}

	const results = await db
		.select({
			id: bookings.id,
			name: bookings.name,
			referenceNumber: bookings.referenceNumber,
			status: bookings.status,
		})
		.from(bookings)
		.where(and(...conditions))
		.orderBy(desc(bookings.createdAt))
		.limit(limit);

	return results;
}
