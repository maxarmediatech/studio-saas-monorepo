import { ORPCError } from "@orpc/server";
import {
	and,
	eq,
	isNull,
	sql,
	bookings,
	bookingParticipants,
	bookingEvents,
	clients,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import { withTransaction, type TransactionClient } from "../../studio/lib/transactions";
import {
	createBookingInputSchema,
	createBookingOutputSchema,
} from "../../studio/schemas/booking";

/**
 * Generate a unique reference number for the booking
 * Format: WB-YYYYMM-XXXX (e.g., WB-202412-0001)
 */
async function generateReferenceNumber(
	tx: TransactionClient,
	organizationId: string,
): Promise<string> {
	const now = new Date();
	const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
	const prefix = `WB-${yearMonth}-`;

	// Get the highest reference number for this month
	const [lastBooking] = await tx
		.select({ referenceNumber: bookings.referenceNumber })
		.from(bookings)
		.where(
			and(
				eq(bookings.organizationId, organizationId),
				sql`${bookings.referenceNumber} LIKE ${prefix + "%"}`,
			),
		)
		.orderBy(sql`${bookings.referenceNumber} DESC`)
		.limit(1);

	let nextNumber = 1;
	if (lastBooking?.referenceNumber) {
		const lastNumber = parseInt(lastBooking.referenceNumber.split("-")[2], 10);
		if (!isNaN(lastNumber)) {
			nextNumber = lastNumber + 1;
		}
	}

	return `${prefix}${String(nextNumber).padStart(4, "0")}`;
}

export const createBooking = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/bookings",
		tags: ["Bookings"],
		summary: "Create booking",
		description: "Create a new booking with participants and optional events",
	})
	.input(createBookingInputSchema)
	.output(createBookingOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "booking", "create");

		const { name, bookingType, packageType, packageCost, note, participants, events } = input;

		return await withTransaction(async (tx) => {
			// Validate all client IDs exist and belong to organization
			const clientIds = participants.map((p) => p.clientId);
			const existingClients = await tx.query.clients.findMany({
				where: and(
					eq(clients.organizationId, context.organizationId),
					isNull(clients.deletedAt),
					sql`${clients.id} IN (${sql.join(
						clientIds.map((id) => sql`${id}`),
						sql`, `,
					)})`,
				),
				columns: { id: true },
			});

			const existingClientIds = new Set(existingClients.map((c) => c.id));
			const missingClientIds = clientIds.filter((id) => !existingClientIds.has(id));

			if (missingClientIds.length > 0) {
				throw new ORPCError("BAD_REQUEST", {
					message: `Client(s) not found: ${missingClientIds.join(", ")}`,
				});
			}

			// Generate reference number
			const referenceNumber = await generateReferenceNumber(tx, context.organizationId);

			// Create booking
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

			// Create participants
			await tx.insert(bookingParticipants).values(
				participants.map((p) => ({
					bookingId: created.id,
					clientId: p.clientId,
					role: p.role,
				})),
			);

			// Create events if provided
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

			return {
				data: { id: created.id },
				message: `Booking created successfully (${referenceNumber})`,
			};
		});
	});
