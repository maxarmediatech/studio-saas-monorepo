import { ORPCError } from "@orpc/server";
import {
	and,
	bookings,
	db,
	eq,
	isNull,
	paymentSchedules,
	receivedAmounts,
	sql,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../../orpc/procedures";
import { formatAmount, trackActivity } from "../../../activities/lib";
import { requirePermission } from "../../../studio/lib/permissions";
import {
	createReceivedInputSchema,
	createReceivedOutputSchema,
} from "../../../studio/schemas/payment";

export const createReceived = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/studio-payments/received",
		tags: ["Studio Payments"],
		summary: "Create received payment",
		description: "Record a new payment received from a client",
	})
	.input(createReceivedInputSchema)
	.output(createReceivedOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "payment", "create");

		const {
			bookingId,
			amount,
			paymentMethod,
			transactionReference,
			receivedDate,
			notes,
			proofAttachment,
			paymentScheduleId,
		} = input;

		// Verify booking exists and belongs to organization
		const booking = await db.query.bookings.findFirst({
			where: and(
				eq(bookings.id, bookingId),
				eq(bookings.organizationId, context.organizationId),
				isNull(bookings.deletedAt),
			),
		});

		if (!booking) {
			throw new ORPCError("NOT_FOUND", {
				message: "Booking not found",
			});
		}

		// If payment schedule is specified, verify it exists and belongs to the booking
		if (paymentScheduleId) {
			const schedule = await db.query.paymentSchedules.findFirst({
				where: and(
					eq(paymentSchedules.id, paymentScheduleId),
					eq(paymentSchedules.bookingId, bookingId),
					eq(paymentSchedules.organizationId, context.organizationId),
					isNull(paymentSchedules.deletedAt),
				),
			});

			if (!schedule) {
				throw new ORPCError("NOT_FOUND", {
					message: "Payment schedule not found",
				});
			}
		}

		// Security: Validate S3 key belongs to this organization (prevents IDOR)
		if (proofAttachment?.key) {
			const expectedPrefix = `orgs/${context.organizationId}/`;
			if (!proofAttachment.key.startsWith(expectedPrefix)) {
				throw new ORPCError("FORBIDDEN", {
					message:
						"Invalid payment proof: file does not belong to this organization",
				});
			}
		}

		// Use transaction to create received amount and update booking totals
		return await db.transaction(async (tx) => {
			// Create received amount
			const [created] = await tx
				.insert(receivedAmounts)
				.values({
					organizationId: context.organizationId,
					bookingId,
					amount,
					paymentMethod,
					transactionReference: transactionReference ?? null,
					receivedDate,
					notes: notes ?? null,
					proofAttachment: proofAttachment ?? null,
					paymentScheduleId: paymentScheduleId ?? null,
					createdBy: context.user.id,
					updatedBy: context.user.id,
				})
				.returning({ id: receivedAmounts.id });

			if (!created) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Failed to create received payment",
				});
			}

			// Update booking total received
			await tx
				.update(bookings)
				.set({
					totalReceived: sql`${bookings.totalReceived} + ${amount}`,
					updatedAt: new Date(),
					updatedBy: context.user.id,
				})
				.where(eq(bookings.id, bookingId));

			// If linked to a schedule, update the schedule's paid amount
			if (paymentScheduleId) {
				const schedule = await tx.query.paymentSchedules.findFirst({
					where: eq(paymentSchedules.id, paymentScheduleId),
				});

				if (schedule) {
					const newPaidAmount =
						Number.parseFloat(schedule.paidAmount) +
						Number.parseFloat(amount);
					const scheduleAmount = Number.parseFloat(schedule.amount);

					let newStatus = schedule.status;
					if (newPaidAmount >= scheduleAmount) {
						newStatus = "completed";
					} else if (newPaidAmount > 0) {
						newStatus = "partial";
					}

					await tx
						.update(paymentSchedules)
						.set({
							paidAmount: newPaidAmount.toFixed(2),
							paidAt:
								newStatus === "completed"
									? new Date()
									: schedule.paidAt,
							status: newStatus,
							updatedAt: new Date(),
							updatedBy: context.user.id,
						})
						.where(eq(paymentSchedules.id, paymentScheduleId));
				}
			}

			// Track activity (non-blocking, outside transaction)
			trackActivity(
				{ organizationId: context.organizationId, user: context.user },
				{
					entityType: "received_amount",
					entityId: created.id,
					entityName: `${formatAmount(amount)} via ${paymentMethod}`,
					action: "payment_received",
					parentEntityType: "booking",
					parentEntityId: bookingId,
					parentEntityName: booking.name,
					metadata: { amount, paymentMethod },
				},
			).catch(console.error);

			return {
				data: { id: created.id },
				message: "Payment recorded successfully",
			};
		});
	});
