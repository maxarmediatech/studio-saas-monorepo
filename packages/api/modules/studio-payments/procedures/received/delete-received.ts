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
import { formatAmount, safeTrackActivity } from "../../../activities/lib";
import { requirePermission } from "../../../studio/lib/permissions";
import {
	deleteReceivedInputSchema,
	deleteReceivedOutputSchema,
} from "../../../studio/schemas/payment";

export const deleteReceived = studioProtectedProcedure
	.route({
		method: "DELETE",
		path: "/studio-payments/received/{id}",
		tags: ["Studio Payments"],
		summary: "Delete received payment",
		description: "Soft delete a received payment record",
	})
	.input(deleteReceivedInputSchema)
	.output(deleteReceivedOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "payment", "delete");

		const { id } = input;

		// Verify received payment exists and belongs to organization
		const received = await db.query.receivedAmounts.findFirst({
			where: and(
				eq(receivedAmounts.id, id),
				eq(receivedAmounts.organizationId, context.organizationId),
				isNull(receivedAmounts.deletedAt),
			),
		});

		if (!received) {
			throw new ORPCError("NOT_FOUND", {
				message: "Received payment not found",
			});
		}

		// Fetch booking for activity tracking (org-scoped for safety)
		const booking = await db.query.bookings.findFirst({
			where: and(
				eq(bookings.id, received.bookingId),
				eq(bookings.organizationId, context.organizationId),
			),
			columns: { name: true },
		});

		const amount = Number.parseFloat(received.amount);

		// Use transaction to soft delete and update booking totals
		return await db.transaction(async (tx) => {
			// Soft delete
			await tx
				.update(receivedAmounts)
				.set({
					deletedAt: new Date(),
					deletedBy: context.user.id,
					updatedAt: new Date(),
					updatedBy: context.user.id,
				})
				.where(eq(receivedAmounts.id, id));

			// Update booking total (subtract the deleted amount)
			await tx
				.update(bookings)
				.set({
					totalReceived: sql`${bookings.totalReceived} - ${amount.toFixed(2)}`,
					updatedAt: new Date(),
					updatedBy: context.user.id,
				})
				.where(eq(bookings.id, received.bookingId));

			if (received.paymentScheduleId) {
				const schedule = await tx.query.paymentSchedules.findFirst({
					where: and(
						eq(paymentSchedules.id, received.paymentScheduleId),
						eq(
							paymentSchedules.organizationId,
							context.organizationId,
						),
						isNull(paymentSchedules.deletedAt),
					),
				});

				if (!schedule) {
					throw new ORPCError("NOT_FOUND", {
						message: "Linked payment schedule not found",
					});
				}

				const [paidResult] = await tx
					.select({
						sum: sql<string>`COALESCE(SUM(${receivedAmounts.amount}), 0)`,
					})
					.from(receivedAmounts)
					.where(
						and(
							eq(
								receivedAmounts.paymentScheduleId,
								received.paymentScheduleId,
							),
							isNull(receivedAmounts.deletedAt),
						),
					);

				const totalPaid = Number.parseFloat(paidResult?.sum ?? "0");
				const scheduleAmount = Number.parseFloat(schedule.amount);

				if (totalPaid > scheduleAmount) {
					throw new ORPCError("CONFLICT", {
						message:
							"Total received exceeds schedule amount. Update the schedule amount before deleting this payment.",
					});
				}

				const status =
					totalPaid >= scheduleAmount
						? "completed"
						: totalPaid > 0
							? "partial"
							: "pending";
				const paidAt =
					status === "completed"
						? (schedule.paidAt ?? new Date())
						: null;

				await tx
					.update(paymentSchedules)
					.set({
						paidAmount: totalPaid.toFixed(2),
						status,
						paidAt,
						updatedAt: new Date(),
						updatedBy: context.user.id,
					})
					.where(eq(paymentSchedules.id, schedule.id));
			}

			// Track activity (non-blocking)
			await safeTrackActivity(
				{ organizationId: context.organizationId, user: context.user },
				{
					entityType: "received_amount",
					entityId: id,
					entityName: `${formatAmount(received.amount)} via ${received.paymentMethod}`,
					action: "deleted",
					parentEntityType: "booking",
					parentEntityId: received.bookingId,
					parentEntityName: booking?.name ?? "Unknown Booking",
					metadata: { amount: received.amount, paymentMethod: received.paymentMethod },
				},
			);

			return {
				data: { id },
				message: "Payment deleted successfully",
			};
		});
	});
