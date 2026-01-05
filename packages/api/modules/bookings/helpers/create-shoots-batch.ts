/**
 * Create Shoots Batch Helper
 *
 * Creates multiple shoots with their crew assignments within a transaction.
 */

import { crews, inArray, shootAssignments, shoots } from "@repo/database";
import type { TransactionClient } from "../../studio/lib/transactions";
import type { ShootInput } from "../../studio/schemas/booking";

export interface CreateShootsBatchResult {
	shootIds: string[];
}

/**
 * Creates multiple shoots with their crew assignments within a transaction.
 *
 * @param tx - Transaction client
 * @param organizationId - Organization ID
 * @param bookingId - Booking ID to associate shoots with
 * @param userId - User ID for audit fields
 * @param shootInputs - Array of shoot data to create
 * @returns Object containing created shoot IDs
 */
export async function createShootsBatch(
	tx: TransactionClient,
	organizationId: string,
	bookingId: string,
	userId: string,
	shootInputs: ShootInput[],
): Promise<CreateShootsBatchResult> {
	if (shootInputs.length === 0) {
		return { shootIds: [] };
	}

	const shootIds: string[] = [];

	for (const shootInput of shootInputs) {
		// Insert shoot
		const [createdShoot] = await tx
			.insert(shoots)
			.values({
				organizationId,
				bookingId,
				name: shootInput.name,
				shootType: shootInput.shootType,
				shootDate: shootInput.shootDate,
				startTime: shootInput.startTime ?? null,
				endTime: shootInput.endTime ?? null,
				venue: shootInput.venue ?? null,
				venueAddress: shootInput.venueAddress ?? null,
				notes: shootInput.notes ?? null,
				status: shootInput.status ?? "scheduled",
				createdBy: userId,
			})
			.returning({ id: shoots.id });

		if (!createdShoot) {
			throw new Error("Failed to create shoot");
		}

		shootIds.push(createdShoot.id);

		// Insert crew assignments for this shoot (skip if empty)
		const crewAssignments = shootInput.crewAssignments?.filter(
			(a) => a.crewId && a.crewId.length > 0,
		);

		if (crewAssignments && crewAssignments.length > 0) {
			// Get crew roles for assignments that don't have a role specified
			const crewIdsNeedingRole = crewAssignments
				.filter((a) => !a.role)
				.map((a) => a.crewId);

			let crewRoleMap = new Map<string, string>();

			if (crewIdsNeedingRole.length > 0) {
				const crewData = await tx
					.select({ id: crews.id, role: crews.role })
					.from(crews)
					.where(inArray(crews.id, crewIdsNeedingRole));

				crewRoleMap = new Map(
					crewData.map((c) => [c.id, c.role ?? "Crew"]),
				);
			}

			await tx.insert(shootAssignments).values(
				crewAssignments.map((assignment) => ({
					shootId: createdShoot.id,
					crewId: assignment.crewId,
					// Use provided role, or fetch from crew profile, or default to "Crew"
					role:
						assignment.role ??
						crewRoleMap.get(assignment.crewId) ??
						"Crew",
					isLead: assignment.isLead ?? false,
					assignedBy: userId,
				})),
			);
		}
	}

	return { shootIds };
}
