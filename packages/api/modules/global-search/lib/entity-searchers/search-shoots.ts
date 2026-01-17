import { and, db, desc, eq, isNull, shoots } from "@repo/database";
import type { ShootSearchResult } from "../../types";
import { buildTextSearchCondition } from "../search-utils";

export async function searchShoots(
	organizationId: string,
	query: string,
	limit: number,
): Promise<ShootSearchResult[]> {
	const conditions = [
		eq(shoots.organizationId, organizationId),
		isNull(shoots.deletedAt),
	];

	const textSearch = buildTextSearchCondition(
		query,
		shoots.name,
		shoots.venue,
		shoots.shootType,
	);

	if (textSearch) {
		conditions.push(textSearch);
	}

	const results = await db
		.select({
			id: shoots.id,
			name: shoots.name,
			shootType: shoots.shootType,
			shootDate: shoots.shootDate,
			bookingId: shoots.bookingId,
		})
		.from(shoots)
		.where(and(...conditions))
		.orderBy(desc(shoots.shootDate))
		.limit(limit);

	return results;
}
