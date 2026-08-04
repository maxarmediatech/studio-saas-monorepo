/**
 * Create Shoots Batch Helper
 *
 * Creates multiple shoots with their crew assignments within a transaction.
 */

import { shootAssignments, shoots } from "@repo/database";
import { isTerminalShootStatus } from "../../shoots/calendar-sync";
import { ensureAssignmentCalendarDelivery } from "../../shoots/lib/calendar-delivery";
import { buildShootPlanningMetadata } from "../../shoots/lib/shoot-planning";
import type { TransactionClient } from "../../studio/lib/transactions";
import type { MaterializedShootInput } from "../lib/materialize-booking";

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
	shootInputs: MaterializedShootInput[],
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
				bookingEventId: shootInput.bookingEventId ?? null,
				name: shootInput.name,
				shootType: shootInput.shootType,
				side: shootInput.side ?? null,
				shootDate: shootInput.shootDate,
				startTime: shootInput.startTime ?? null,
				endTime: shootInput.endTime ?? null,
				venue: shootInput.venue ?? null,
				venueAddress: shootInput.venueAddress ?? null,
				notes: shootInput.notes ?? null,
				metadata: buildShootPlanningMetadata(null, {
					requiredCrewCount: shootInput.requiredCrewCount ?? null,
					additionalServices: shootInput.additionalServices ?? [],
				}),
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
			await tx.insert(shootAssignments).values(
				crewAssignments.map((assignment) => {
					const trimmedRate = assignment.rate?.trim();

					return {
						shootId: createdShoot.id,
						crewId: assignment.crewId,
						// Crew profile role is deprecated; keep assignment role generic.
						role: assignment.role ?? "Crew",
						isLead: assignment.isLead ?? false,
						rate:
							trimmedRate && /^\d+(\.\d{1,2})?$/.test(trimmedRate)
								? trimmedRate
								: null, // Per-shoot rate (null if not specified/invalid)
						assignedBy: userId,
					};
				}),
			);

			if (!isTerminalShootStatus(shootInput.status)) {
				for (const assignment of crewAssignments) {
					await ensureAssignmentCalendarDelivery(tx, {
						organizationId,
						shootId: createdShoot.id,
						crewId: assignment.crewId,
					});
				}
			}
		}
	}

	return { shootIds };
}
