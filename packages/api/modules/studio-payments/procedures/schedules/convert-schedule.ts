import { ORPCError } from "@orpc/server";
import {
	and,
	eq,
	isNull,
	sql,
	paymentSchedules,
	receivedAmounts,
	bookings,
	db,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../../orpc/procedures";
import { requirePermission } from "../../../studio/lib/permissions";
import {
	convertScheduleInputSchema,
	convertScheduleOutputSchema,
} from "../../../studio/schemas/payment";

export const convertSchedule = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/studio-payments/schedules/{scheduleId}/convert",
		tags: ["Studio Payments"],
		summary: "Convert schedule to received",
		description: "Mark a payment schedule as paid by creating a received payment record",
	})
	.input(convertScheduleInputSchema)
	.output(convertScheduleOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "payment", "create");

		const { scheduleId, paymentMethod, transactionReference, receivedDate, notes } = input;

		// Use transaction for atomicity
		return await db.transaction(async (tx) => {
			// Fetch schedule with lock
			const schedule = await tx.query.paymentSchedules.findFirst({
				where: and(
					eq(paymentSchedules.id, scheduleId),
					eq(paymentSchedules.organizationId, context.organizationId),
					isNull(paymentSchedules.deletedAt),
				),
			});

			if (!schedule) {
				throw new ORPCError("NOT_FOUND", {
					message: "Payment schedule not found",
				});
			}

			// Check if already completed (idempotency)
			if (schedule.status === "completed") {
				// Find existing received amount linked to this schedule
				const existing = await tx.query.receivedAmounts.findFirst({
					where: and(
						eq(receivedAmounts.paymentScheduleId, scheduleId),
						isNull(receivedAmounts.deletedAt),
					),
				});

				return {
					data: {
						receivedId: existing?.id ?? scheduleId,
						scheduleId,
					},
					message: "Schedule already converted to payment",
				};
			}

			// Calculate remaining amount to pay
			const scheduleAmount = parseFloat(schedule.amount);
			const paidAmount = parseFloat(schedule.paidAmount);
			const remainingAmount = scheduleAmount - paidAmount;

			if (remainingAmount <= 0) {
				throw new ORPCError("CONFLICT", {
					message: "Schedule is already fully paid",
				});
			}

			// Use current date if not provided
			const actualReceivedDate = receivedDate ?? new Date().toISOString().split("T")[0];

			// Create received amount for the remaining balance
			const [created] = await tx
				.insert(receivedAmounts)
				.values({
					organizationId: context.organizationId,
					bookingId: schedule.bookingId,
					amount: remainingAmount.toFixed(2),
					paymentMethod,
					transactionReference: transactionReference ?? null,
					receivedDate: actualReceivedDate,
					notes: notes ?? null,
					paymentScheduleId: scheduleId,
					createdBy: context.user.id,
					updatedBy: context.user.id,
				})
				.returning({ id: receivedAmounts.id });

			if (!created) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Failed to create received payment",
				});
			}

			// Update schedule to completed
			await tx
				.update(paymentSchedules)
				.set({
					paidAmount: scheduleAmount.toFixed(2),
					paidAt: new Date(),
					status: "completed",
					updatedAt: new Date(),
					updatedBy: context.user.id,
				})
				.where(eq(paymentSchedules.id, scheduleId));

			// Update booking total received
			await tx
				.update(bookings)
				.set({
					totalReceived: sql`${bookings.totalReceived} + ${remainingAmount.toFixed(2)}`,
					updatedAt: new Date(),
					updatedBy: context.user.id,
				})
				.where(eq(bookings.id, schedule.bookingId));

			return {
				data: {
					receivedId: created.id,
					scheduleId,
				},
				message: "Payment schedule converted successfully",
			};
		});
	});
