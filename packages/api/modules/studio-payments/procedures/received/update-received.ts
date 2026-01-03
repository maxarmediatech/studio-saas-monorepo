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
import { requirePermission } from "../../../studio/lib/permissions";
import {
	updateReceivedInputSchema,
	updateReceivedOutputSchema,
} from "../../../studio/schemas/payment";

export const updateReceived = studioProtectedProcedure
	.route({
		method: "PUT",
		path: "/studio-payments/received/{id}",
		tags: ["Studio Payments"],
		summary: "Update received payment",
		description: "Update an existing received payment record",
	})
	.input(updateReceivedInputSchema)
	.output(updateReceivedOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "payment", "update");

		const { id, ...updates } = input;

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

		// If amount is being updated, we need to update booking totals
		const amountChanged =
			updates.amount !== undefined && updates.amount !== received.amount;
		const oldAmount = Number.parseFloat(received.amount);
		const newAmount = updates.amount
			? Number.parseFloat(updates.amount)
			: oldAmount;

		// Build update object
		const updateData: Record<string, unknown> = {
			updatedAt: new Date(),
			updatedBy: context.user.id,
		};

		if (updates.amount !== undefined) {
			updateData.amount = updates.amount;
		}

		if (updates.paymentMethod !== undefined) {
			updateData.paymentMethod = updates.paymentMethod;
		}

		if (updates.transactionReference !== undefined) {
			updateData.transactionReference = updates.transactionReference;
		}

		if (updates.receivedDate !== undefined) {
			updateData.receivedDate = updates.receivedDate;
		}

		if (updates.notes !== undefined) {
			updateData.notes = updates.notes;
		}

		// Use transaction if amount changed
		if (amountChanged) {
			return await db.transaction(async (tx) => {
				// Update received amount
				await tx
					.update(receivedAmounts)
					.set(updateData)
					.where(eq(receivedAmounts.id, id));

				// Update booking total (subtract old, add new)
				const amountDiff = newAmount - oldAmount;
				await tx
					.update(bookings)
					.set({
						totalReceived: sql`${bookings.totalReceived} + ${amountDiff.toFixed(2)}`,
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
								"Total received exceeds schedule amount. Update the schedule amount before changing this payment.",
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

				return {
					data: { id },
					message: "Payment updated successfully",
				};
			});
		}

		// No amount change, simple update
		await db
			.update(receivedAmounts)
			.set(updateData)
			.where(eq(receivedAmounts.id, id));

		return {
			data: { id },
			message: "Payment updated successfully",
		};
	});
