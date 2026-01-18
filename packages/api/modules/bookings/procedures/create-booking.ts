import { ORPCError } from "@orpc/server";
import {
	and,
	attachments,
	bookingEvents,
	bookingParticipants,
	bookings,
	clients,
	eq,
	inArray,
	isNull,
	sql,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { safeTrackActivity } from "../../activities/lib";
import { requirePermission } from "../../studio/lib/permissions";
import {
	type TransactionClient,
	withTransaction,
} from "../../studio/lib/transactions";
import {
	createBookingInputSchema,
	createBookingOutputSchema,
} from "../../studio/schemas/booking";
import {
	createDeliverablesBatch,
	createPaymentsBatch,
	createShootsBatch,
	validateCrewIds,
} from "../helpers";

/**
 * Generate a unique reference number for the booking
 * Format: BKNYYYYMMXXXX (e.g., BKN2024120001)
 * Supports up to 9,999 bookings per month per studio
 */
async function generateReferenceNumber(
	tx: TransactionClient,
	organizationId: string,
): Promise<string> {
	const now = new Date();
	const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
	const prefix = `BKN${yearMonth}`;

	// Get the highest reference number for this month
	const [lastBooking] = await tx
		.select({ referenceNumber: bookings.referenceNumber })
		.from(bookings)
		.where(
			and(
				eq(bookings.organizationId, organizationId),
				sql`${bookings.referenceNumber} LIKE ${`${prefix}%`}`,
			),
		)
		.orderBy(sql`${bookings.referenceNumber} DESC`)
		.limit(1);

	let nextNumber = 1;
	if (lastBooking?.referenceNumber) {
		// Extract the last 4 digits (sequence number)
		const lastNumberStr = lastBooking.referenceNumber.slice(-4);
		const lastNumber = Number.parseInt(lastNumberStr, 10);
		if (!Number.isNaN(lastNumber)) {
			nextNumber = lastNumber + 1;
		}
	}

	if (nextNumber > 9999) {
		throw new ORPCError("CONFLICT", {
			message:
				"Monthly booking reference limit reached (max 9,999 per organization)",
		});
	}

	return `${prefix}${String(nextNumber).padStart(4, "0")}`;
}

/**
 * Collect all crew IDs from shoots and deliverables for validation
 */
function collectCrewIds(
	shoots: { crewAssignments?: { crewId: string }[] }[] | undefined,
	deliverables: { crewAssignments?: { crewId: string }[] }[] | undefined,
): string[] {
	const crewIds: string[] = [];

	if (shoots) {
		for (const shoot of shoots) {
			if (shoot.crewAssignments) {
				crewIds.push(
					...shoot.crewAssignments
						.filter((a) => a.crewId && a.crewId.length > 0)
						.map((a) => a.crewId),
				);
			}
		}
	}

	if (deliverables) {
		for (const deliverable of deliverables) {
			if (deliverable.crewAssignments) {
				crewIds.push(
					...deliverable.crewAssignments
						.filter((a) => a.crewId && a.crewId.length > 0)
						.map((a) => a.crewId),
				);
			}
		}
	}

	return crewIds;
}

export const createBooking = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/bookings",
		tags: ["Bookings"],
		summary: "Create booking",
		description:
			"Create a new booking with participants, shoots, deliverables, and payments",
	})
	.input(createBookingInputSchema)
	.output(createBookingOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "booking", "create");

		const {
			name,
			bookingType,
			packageType,
			packageCost,
			note,
			participants,
			events,
			contractAttachment,
			shoots,
			deliverables,
			receivedPayments,
			paymentSchedules,
		} = input;

		return await withTransaction(async (tx) => {
			// 1. Validate all client IDs exist and belong to organization
			const clientIds = participants.map((p) => p.clientId);
			const existingClients = await tx.query.clients.findMany({
				where: and(
					eq(clients.organizationId, context.organizationId),
					isNull(clients.deletedAt),
					inArray(clients.id, clientIds),
				),
				columns: { id: true },
			});

			const existingClientIds = new Set(existingClients.map((c) => c.id));
			const missingClientIds = clientIds.filter(
				(id) => !existingClientIds.has(id),
			);

			if (missingClientIds.length > 0) {
				throw new ORPCError("BAD_REQUEST", {
					message: `Client(s) not found: ${missingClientIds.join(", ")}`,
				});
			}

			// 2. Collect and validate all crew IDs (if any)
			const allCrewIds = collectCrewIds(shoots, deliverables);
			if (allCrewIds.length > 0) {
				await validateCrewIds(tx, context.organizationId, allCrewIds);
			}

			// 3. Generate reference number
			const referenceNumber = await generateReferenceNumber(
				tx,
				context.organizationId,
			);

			// 4. Create booking
			const [created] = await tx
				.insert(bookings)
				.values({
					organizationId: context.organizationId,
					referenceNumber,
					name,
					bookingType,
					packageType,
					packageCost,
					status: "new",
					totalReceived: "0",
					totalExpenses: "0",
					note: note ?? null,
					createdBy: context.user.id,
				})
				.returning({ id: bookings.id });

			if (!created) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Failed to create booking",
				});
			}

			// 5. Create participants
			await tx.insert(bookingParticipants).values(
				participants.map((p) => ({
					bookingId: created.id,
					clientId: p.clientId,
					role: p.role,
				})),
			);

			// 6. Create events if provided
			if (events && events.length > 0) {
				await tx.insert(bookingEvents).values(
					events.map((e) => ({
						bookingId: created.id,
						organizationId: context.organizationId,
						eventType: e.eventType,
						eventDate: new Date(e.eventDate),
						venue: e.venue ?? null,
						venueAddress: e.venueAddress ?? null,
						notes: e.notes ?? null,
					})),
				);
			}

			// 7. Create shoots with crew assignments
			if (shoots && shoots.length > 0) {
				await createShootsBatch(
					tx,
					context.organizationId,
					created.id,
					context.user.id,
					shoots,
				);
			}

			// 8. Create deliverables with crew assignments
			if (deliverables && deliverables.length > 0) {
				await createDeliverablesBatch(
					tx,
					context.organizationId,
					created.id,
					context.user.id,
					deliverables,
				);
			}

			// 9. Create payments and schedules
			if (
				(receivedPayments && receivedPayments.length > 0) ||
				(paymentSchedules && paymentSchedules.length > 0)
			) {
				await createPaymentsBatch(
					tx,
					context.organizationId,
					created.id,
					context.user.id,
					receivedPayments ?? [],
					paymentSchedules ?? [],
				);
			}

			// 10. Create contract attachment if provided
			if (contractAttachment) {
				// Security: Validate S3 key belongs to this organization (prevents IDOR)
				const expectedPrefix = `orgs/${context.organizationId}/`;
				if (!contractAttachment.key.startsWith(expectedPrefix)) {
					throw new ORPCError("FORBIDDEN", {
						message:
							"Invalid attachment: file does not belong to this organization",
					});
				}

				await tx.insert(attachments).values({
					organizationId: context.organizationId,
					entityType: "booking",
					entityId: created.id,
					fileName: contractAttachment.name,
					fileUrl: contractAttachment.key, // Store S3 key, not signed URL
					fileSize: contractAttachment.size,
					mimeType: contractAttachment.type,
					description: "contract",
					uploadedBy: context.user.id,
				});
			}

			// Track activity (inside transaction to get name)
			await safeTrackActivity(
				{ organizationId: context.organizationId, user: context.user },
				{
					entityType: "booking",
					entityId: created.id,
					entityName: name,
					action: "created",
					metadata: {
						referenceNumber,
						packageType,
						packageCost,
					},
				},
			);

			return {
				data: { id: created.id },
				message: `Booking created successfully (${referenceNumber})`,
			};
		});
	});
