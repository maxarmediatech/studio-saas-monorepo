/**
 * Create Deliverables Batch Helper
 *
 * Creates multiple deliverables with their crew assignments within a transaction.
 */

import { deliverableAssignments, deliverables } from "@repo/database";
import type { TransactionClient } from "../../studio/lib/transactions";
import type { DeliverableInput } from "../../studio/schemas/booking";

export interface CreateDeliverablesBatchResult {
	deliverableIds: string[];
}

/**
 * Creates multiple deliverables with their crew assignments within a transaction.
 *
 * @param tx - Transaction client
 * @param organizationId - Organization ID
 * @param bookingId - Booking ID to associate deliverables with
 * @param userId - User ID for audit fields
 * @param deliverableInputs - Array of deliverable data to create
 * @returns Object containing created deliverable IDs
 */
export async function createDeliverablesBatch(
	tx: TransactionClient,
	organizationId: string,
	bookingId: string,
	userId: string,
	deliverableInputs: DeliverableInput[],
): Promise<CreateDeliverablesBatchResult> {
	if (deliverableInputs.length === 0) {
		return { deliverableIds: [] };
	}

	const deliverableIds: string[] = [];

	for (const deliverableInput of deliverableInputs) {
		// Filter out empty crew assignments
		const crewAssignments = deliverableInput.crewAssignments?.filter(
			(a) => a.crewId && a.crewId.length > 0,
		);
		const hasCrewAssignments =
			crewAssignments && crewAssignments.length > 0;

		// Insert deliverable
		const [createdDeliverable] = await tx
			.insert(deliverables)
			.values({
				organizationId,
				bookingId,
				name: deliverableInput.name,
				deliverableType: deliverableInput.deliverableType,
				description: deliverableInput.description ?? null,
				dueDate: deliverableInput.dueDate ?? null,
				// Package relationship fields
				quantity: deliverableInput.quantity ?? 1,
				cost: deliverableInput.cost ?? null,
				isPackageIncluded: deliverableInput.isPackageIncluded ?? false,
				status: "pending",
				priority: "normal",
				// Set workflow status to "assigned" if crew is assigned
				workflowStatus: hasCrewAssignments ? "assigned" : "not_started",
				createdBy: userId,
				updatedBy: userId,
			})
			.returning({ id: deliverables.id });

		if (!createdDeliverable) {
			throw new Error("Failed to create deliverable");
		}

		deliverableIds.push(createdDeliverable.id);

		// Insert crew assignments for this deliverable (skip if empty)
		if (hasCrewAssignments) {
			await tx.insert(deliverableAssignments).values(
				crewAssignments.map((assignment) => ({
					deliverableId: createdDeliverable.id,
					crewId: assignment.crewId,
					isLead: assignment.isLead ?? false,
					assignedBy: userId,
				})),
			);
		}
	}

	return { deliverableIds };
}
