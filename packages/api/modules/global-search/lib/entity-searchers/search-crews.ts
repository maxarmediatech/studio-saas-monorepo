import { and, crews, db, desc, eq, isNull } from "@repo/database";
import type { CrewSearchResult } from "../../types";
import { buildTextSearchCondition } from "../search-utils";

export async function searchCrews(
	organizationId: string,
	query: string,
	limit: number,
): Promise<CrewSearchResult[]> {
	const conditions = [
		eq(crews.organizationId, organizationId),
		isNull(crews.deletedAt),
	];

	const textSearch = buildTextSearchCondition(
		query,
		crews.name,
		crews.email,
		crews.phoneNumber,
	);

	if (textSearch) {
		conditions.push(textSearch);
	}

	const results = await db
		.select({
			id: crews.id,
			name: crews.name,
			email: crews.email,
		})
		.from(crews)
		.where(and(...conditions))
		.orderBy(desc(crews.createdAt))
		.limit(limit);

	return results;
}
