import { and, clients, db, desc, eq, isNull } from "@repo/database";
import type { ClientSearchResult } from "../../types";
import { buildTextSearchCondition } from "../search-utils";

export async function searchClients(
	organizationId: string,
	query: string,
	limit: number,
): Promise<ClientSearchResult[]> {
	const conditions = [
		eq(clients.organizationId, organizationId),
		isNull(clients.deletedAt),
	];

	const textSearch = buildTextSearchCondition(
		query,
		clients.name,
		clients.email,
		clients.phoneNumber,
	);

	if (textSearch) {
		conditions.push(textSearch);
	}

	const results = await db
		.select({
			id: clients.id,
			name: clients.name,
			email: clients.email,
			phoneNumber: clients.phoneNumber,
		})
		.from(clients)
		.where(and(...conditions))
		.orderBy(desc(clients.createdAt))
		.limit(limit);

	return results;
}
