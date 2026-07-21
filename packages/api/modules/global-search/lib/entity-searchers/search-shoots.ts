import { and, db, desc, eq, isNull, shoots } from "@repo/database";
import { buildShootSearchCondition } from "../../../studio/lib/entity-search";
import type { ShootSearchResult } from "../../types";

interface SearchShootsOptions {
	includeClientNames?: boolean;
}

export async function searchShoots(
	organizationId: string,
	query: string,
	limit: number,
	options: SearchShootsOptions = {},
): Promise<ShootSearchResult[]> {
	const conditions = [
		eq(shoots.organizationId, organizationId),
		isNull(shoots.deletedAt),
	];
	const searchCondition = buildShootSearchCondition(
		query,
		organizationId,
		options,
	);

	if (searchCondition) {
		conditions.push(searchCondition);
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
