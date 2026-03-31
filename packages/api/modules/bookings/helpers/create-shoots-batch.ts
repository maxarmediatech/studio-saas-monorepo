/**
 * Create Shoots Batch Helper
 *
 * Creates multiple shoots with their crew assignments within a transaction.
 */

import {
	and,
	calendarSyncJobs,
	crews,
	eq,
	googleCalendarConnections,
	inArray,
	isNotNull,
	isNull,
	shootAssignments,
	shootCalendarEvents,
	shoots,
} from "@repo/database";
import { logger } from "@repo/logs";
import { isTerminalShootStatus } from "../../shoots/calendar-sync";
import { buildShootPlanningMetadata } from "../../shoots/lib/shoot-planning";
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
				try {
					// Isolate side-effects with a savepoint so failures don't break booking creation.
					await tx.transaction(async (calendarTx) => {
						const crewIds = Array.from(
							new Set(
								crewAssignments.map(
									(assignment) => assignment.crewId,
								),
							),
						);

						if (crewIds.length === 0) {
							return;
						}

						const assignedCrews = await calendarTx
							.select({
								id: crews.id,
								userId: crews.userId,
								email: crews.email,
							})
							.from(crews)
							.where(
								and(
									eq(crews.organizationId, organizationId),
									inArray(crews.id, crewIds),
									isNull(crews.deletedAt),
								),
							);

						const userIds = assignedCrews
							.map((crew) => crew.userId)
							.filter((value): value is string => Boolean(value));

						const connections = userIds.length
							? await calendarTx
									.select({
										userId: googleCalendarConnections.userId,
									})
									.from(googleCalendarConnections)
									.where(
										and(
											eq(
												googleCalendarConnections.organizationId,
												organizationId,
											),
											inArray(
												googleCalendarConnections.userId,
												userIds,
											),
											isNull(
												googleCalendarConnections.disconnectedAt,
											),
											isNotNull(
												googleCalendarConnections.refreshToken,
											),
										),
									)
							: [];

						const connectedUserIds = new Set(
							connections.map((connection) => connection.userId),
						);

						const mappingRows: Array<{
							organizationId: string;
							shootId: string;
							crewId: string;
							deliveryMethod: "google" | "ics";
							recipientEmail?: string;
							icalUid?: string;
							syncStatus: "pending";
							updatedAt: Date;
						}> = [];
						const jobRows: Array<{
							organizationId: string;
							status: "pending";
							jobType: "google_create" | "ics_send_invite";
							shootId: string;
							crewId: string;
							updatedAt: Date;
						}> = [];

						for (const crew of assignedCrews) {
							if (
								crew.userId &&
								connectedUserIds.has(crew.userId)
							) {
								mappingRows.push({
									organizationId,
									shootId: createdShoot.id,
									crewId: crew.id,
									deliveryMethod: "google",
									syncStatus: "pending",
									updatedAt: new Date(),
								});
								jobRows.push({
									organizationId,
									status: "pending",
									jobType: "google_create",
									shootId: createdShoot.id,
									crewId: crew.id,
									updatedAt: new Date(),
								});
								continue;
							}

							if (!crew.userId && crew.email) {
								mappingRows.push({
									organizationId,
									shootId: createdShoot.id,
									crewId: crew.id,
									deliveryMethod: "ics",
									recipientEmail: crew.email,
									icalUid: `shoot-${createdShoot.id}-crew-${crew.id}@studio-saas.invalid`,
									syncStatus: "pending",
									updatedAt: new Date(),
								});
								jobRows.push({
									organizationId,
									status: "pending",
									jobType: "ics_send_invite",
									shootId: createdShoot.id,
									crewId: crew.id,
									updatedAt: new Date(),
								});
							}
						}

						if (mappingRows.length > 0) {
							await calendarTx
								.insert(shootCalendarEvents)
								.values(mappingRows);
						}
						if (jobRows.length > 0) {
							await calendarTx
								.insert(calendarSyncJobs)
								.values(jobRows);
						}
					});
				} catch (error) {
					logger.error(
						"Failed to enqueue calendar jobs in createShootsBatch",
						{
							shootId: createdShoot.id,
							organizationId,
							error:
								error instanceof Error
									? error.message
									: String(error),
						},
					);
				}
			}
		}
	}

	return { shootIds };
}
