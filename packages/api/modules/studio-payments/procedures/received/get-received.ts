import { ORPCError } from "@orpc/server";
import {
	and,
	eq,
	isNull,
	receivedAmounts,
	paymentSchedules,
	bookings,
	db,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../../orpc/procedures";
import { requirePermission } from "../../../studio/lib/permissions";
import {
	getReceivedInputSchema,
	getReceivedOutputSchema,
} from "../../../studio/schemas/payment";

export const getReceived = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/studio-payments/received/{id}",
		tags: ["Studio Payments"],
		summary: "Get received payment",
		description: "Get detailed information about a specific received payment",
	})
	.input(getReceivedInputSchema)
	.output(getReceivedOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "payment", "read");

		const { id } = input;

		// Get received amount with booking info
		const result = await db
			.select({
				id: receivedAmounts.id,
				organizationId: receivedAmounts.organizationId,
				bookingId: receivedAmounts.bookingId,
				amount: receivedAmounts.amount,
				paymentMethod: receivedAmounts.paymentMethod,
				transactionReference: receivedAmounts.transactionReference,
				receivedDate: receivedAmounts.receivedDate,
				notes: receivedAmounts.notes,
				paymentScheduleId: receivedAmounts.paymentScheduleId,
				createdBy: receivedAmounts.createdBy,
				updatedBy: receivedAmounts.updatedBy,
				createdAt: receivedAmounts.createdAt,
				updatedAt: receivedAmounts.updatedAt,
				deletedAt: receivedAmounts.deletedAt,
				deletedBy: receivedAmounts.deletedBy,
				bookingName: bookings.name,
				bookingReferenceNumber: bookings.referenceNumber,
			})
			.from(receivedAmounts)
			.innerJoin(bookings, eq(receivedAmounts.bookingId, bookings.id))
			.where(
				and(
					eq(receivedAmounts.id, id),
					eq(receivedAmounts.organizationId, context.organizationId),
					isNull(receivedAmounts.deletedAt),
				),
			)
			.limit(1);

		const received = result[0];

		if (!received) {
			throw new ORPCError("NOT_FOUND", {
				message: "Received payment not found",
			});
		}

		// Get schedule info if linked
		let schedule: { id: string; name: string } | null = null;
		if (received.paymentScheduleId) {
			const scheduleResult = await db
				.select({
					id: paymentSchedules.id,
					name: paymentSchedules.name,
				})
				.from(paymentSchedules)
				.where(eq(paymentSchedules.id, received.paymentScheduleId))
				.limit(1);

			if (scheduleResult[0]) {
				schedule = scheduleResult[0];
			}
		}

		return {
			data: {
				id: received.id,
				organizationId: received.organizationId,
				bookingId: received.bookingId,
				amount: received.amount,
				paymentMethod: received.paymentMethod,
				transactionReference: received.transactionReference,
				receivedDate: received.receivedDate,
				notes: received.notes,
				paymentScheduleId: received.paymentScheduleId,
				createdBy: received.createdBy,
				updatedBy: received.updatedBy,
				createdAt: received.createdAt.toISOString(),
				updatedAt: received.updatedAt.toISOString(),
				deletedAt: received.deletedAt?.toISOString() ?? null,
				deletedBy: received.deletedBy,
				booking: {
					id: received.bookingId,
					name: received.bookingName,
					referenceNumber: received.bookingReferenceNumber,
				},
				schedule,
			},
		};
	});
