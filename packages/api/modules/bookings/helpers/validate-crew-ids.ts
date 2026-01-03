/**
 * Crew Validation Helper
 *
 * Validates that all crew IDs exist and belong to the organization.
 * Used during booking creation to validate crew assignments for shoots and deliverables.
 */

import { ORPCError } from "@orpc/server";
import { and, crews, eq, isNull, sql } from "@repo/database";
import type { TransactionClient } from "../../studio/lib/transactions";

/**
 * Validates that all provided crew IDs exist and belong to the organization.
 * Call this ONCE at the start of the transaction with all crew IDs collected
 * from shoots and deliverables.
 *
 * @param tx - Transaction client
 * @param organizationId - Organization ID
 * @param crewIds - Array of crew IDs to validate
 * @throws ORPCError if any crew IDs are not found
 */
export async function validateCrewIds(
	tx: TransactionClient,
	organizationId: string,
	crewIds: string[],
): Promise<void> {
	if (crewIds.length === 0) {
		return;
	}

	// Deduplicate crew IDs
	const uniqueCrewIds = [...new Set(crewIds)];

	const existingCrews = await tx.query.crews.findMany({
		where: and(
			eq(crews.organizationId, organizationId),
			isNull(crews.deletedAt),
			sql`${crews.id} IN (${sql.join(
				uniqueCrewIds.map((id) => sql`${id}`),
				sql`, `,
			)})`,
		),
		columns: { id: true },
	});

	const existingCrewIds = new Set(existingCrews.map((c) => c.id));
	const missingCrewIds = uniqueCrewIds.filter(
		(id) => !existingCrewIds.has(id),
	);

	if (missingCrewIds.length > 0) {
		throw new ORPCError("BAD_REQUEST", {
			message: `Crew member(s) not found: ${missingCrewIds.join(", ")}`,
		});
	}
}
