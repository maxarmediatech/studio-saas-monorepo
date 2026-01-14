import { and, db, desc, eq, isNull, tasks } from "@repo/database";
import type { TaskSearchResult } from "../../types";
import { buildTextSearchCondition } from "../search-utils";

export async function searchTasks(
	organizationId: string,
	query: string,
	limit: number,
): Promise<TaskSearchResult[]> {
	const conditions = [
		eq(tasks.organizationId, organizationId),
		isNull(tasks.deletedAt),
	];

	const textSearch = buildTextSearchCondition(
		query,
		tasks.name,
		tasks.description,
	);

	if (textSearch) {
		conditions.push(textSearch);
	}

	const results = await db
		.select({
			id: tasks.id,
			name: tasks.name,
			status: tasks.status,
			dueDate: tasks.dueDate,
			bookingId: tasks.bookingId,
		})
		.from(tasks)
		.where(and(...conditions))
		.orderBy(desc(tasks.createdAt))
		.limit(limit);

	return results;
}
