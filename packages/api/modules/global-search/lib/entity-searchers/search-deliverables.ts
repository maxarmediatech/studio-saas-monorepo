import { and, db, deliverables, desc, eq, isNull } from "@repo/database";
import { buildDeliverableSearchCondition } from "../../../studio/lib/entity-search";
import type { DeliverableSearchResult } from "../../types";

interface SearchDeliverablesOptions {
	includeClientNames?: boolean;
}

export async function searchDeliverables(
	organizationId: string,
	query: string,
	limit: number,
	options: SearchDeliverablesOptions = {},
): Promise<DeliverableSearchResult[]> {
	const conditions = [
		eq(deliverables.organizationId, organizationId),
		isNull(deliverables.deletedAt),
	];
	const searchCondition = buildDeliverableSearchCondition(
		query,
		organizationId,
		options,
	);

	if (searchCondition) {
		conditions.push(searchCondition);
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
