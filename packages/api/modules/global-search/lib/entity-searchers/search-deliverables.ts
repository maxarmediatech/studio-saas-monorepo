import { and, db, deliverables, desc, eq, isNull } from "@repo/database";
import type { DeliverableSearchResult } from "../../types";
import { buildTextSearchCondition } from "../search-utils";

export async function searchDeliverables(
	organizationId: string,
	query: string,
	limit: number,
): Promise<DeliverableSearchResult[]> {
	const conditions = [
		eq(deliverables.organizationId, organizationId),
		isNull(deliverables.deletedAt),
	];

	const textSearch = buildTextSearchCondition(
		query,
		deliverables.name,
		deliverables.description,
	);

	if (textSearch) {
		conditions.push(textSearch);
	}

	const results = await db
		.select({
			id: deliverables.id,
			name: deliverables.name,
			status: deliverables.status,
			dueDate: deliverables.dueDate,
			bookingId: deliverables.bookingId,
		})
		.from(deliverables)
		.where(and(...conditions))
		.orderBy(desc(deliverables.createdAt))
		.limit(limit);

	return results;
}
