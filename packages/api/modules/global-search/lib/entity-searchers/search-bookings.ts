import { and, bookings, db, desc, eq, isNull } from "@repo/database";
import { buildBookingSearchCondition } from "../../../studio/lib/entity-search";
import type { BookingSearchResult } from "../../types";

interface SearchBookingsOptions {
	includePaymentAmounts?: boolean;
}

export async function searchBookings(
	organizationId: string,
	query: string,
	limit: number,
	options: SearchBookingsOptions = {},
): Promise<BookingSearchResult[]> {
	const conditions = [
		eq(bookings.organizationId, organizationId),
		isNull(bookings.deletedAt),
	];
	const searchCondition = buildBookingSearchCondition(
		query,
		organizationId,
		options,
	);

	if (searchCondition) {
		conditions.push(searchCondition);
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
		.orderBy(desc(bookings.bookingDate))
		.limit(limit);

	return results;
}
