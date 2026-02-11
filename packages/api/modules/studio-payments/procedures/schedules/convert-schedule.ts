import { ORPCError } from "@orpc/server";
import {
	and,
	bookings,
	db,
	eq,
	invoices,
	isNull,
	paymentSchedules,
	receipts,
	receivedAmounts,
	sql,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../../orpc/procedures";
import { formatAmount, safeTrackActivity } from "../../../activities/lib";
import {
	generateReceiptNumber,
	updateInvoicePaymentStatus,
} from "../../../receipts/lib/receipt-helpers";
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
		description:
			"Mark a payment schedule as paid by creating a received payment record",
	})
	.input(convertScheduleInputSchema)
	.output(convertScheduleOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "payment", "create");

		const {
			scheduleId,
			amount,
			paymentMethod,
			transactionReference,
			receivedDate,
			notes,
		} = input;

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

			if (schedule.status === "completed") {
				throw new ORPCError("CONFLICT", {
					message: "Schedule is already completed",
				});
			}

			if (schedule.status === "cancelled") {
				throw new ORPCError("CONFLICT", {
					message: "Cancelled schedule cannot be converted",
				});
			}

			const convertedAmount = Number.parseFloat(amount);
			const scheduleAmount = Number.parseFloat(schedule.amount);
			const existingPaidAmount = Number.parseFloat(schedule.paidAmount);
			const newPaidAmount = existingPaidAmount + convertedAmount;

			if (!Number.isFinite(convertedAmount) || convertedAmount <= 0) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Amount must be greater than zero",
				});
			}

			if (newPaidAmount > scheduleAmount) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Amount cannot exceed remaining scheduled balance",
				});
			}

			const convertedAmountString = convertedAmount.toFixed(2);
			const newPaidAmountString = newPaidAmount.toFixed(2);

			// Use current date if not provided
			const actualReceivedDate =
				receivedDate ?? new Date().toISOString().split("T")[0];

			const linkedInvoice = await tx.query.invoices.findFirst({
				where: and(
					eq(invoices.paymentScheduleId, scheduleId),
					eq(invoices.organizationId, context.organizationId),
					isNull(invoices.deletedAt),
				),
				columns: {
					id: true,
					status: true,
				},
			});

			const [created] = await tx
				.insert(receivedAmounts)
				.values({
					organizationId: context.organizationId,
					bookingId: schedule.bookingId,
					amount: convertedAmountString,
					paymentMethod,
					transactionReference: transactionReference ?? null,
					receivedDate: actualReceivedDate,
					notes: notes ?? null,
					paymentScheduleId: scheduleId,
					invoiceId: linkedInvoice?.id ?? null,
					createdBy: context.user.id,
					updatedBy: context.user.id,
				})
				.returning({ id: receivedAmounts.id });

			if (!created) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Failed to create received payment",
				});
			}

			let receiptId: string | null = null;

			if (linkedInvoice) {
				if (linkedInvoice.status === "cancelled") {
					throw new ORPCError("CONFLICT", {
						message:
							"Cannot convert schedule linked to a cancelled invoice",
					});
				}

				if (linkedInvoice.status === "draft") {
					await tx
						.update(invoices)
						.set({
							status: "sent",
							updatedAt: new Date(),
							updatedBy: context.user.id,
						})
						.where(eq(invoices.id, linkedInvoice.id));
				}

				const receiptNumber = await generateReceiptNumber(
					schedule.bookingId,
					context.organizationId,
				);

				const [createdReceipt] = await tx
					.insert(receipts)
					.values({
						organizationId: context.organizationId,
						bookingId: schedule.bookingId,
						invoiceId: linkedInvoice.id,
						receivedAmountId: created.id,
						receiptNumber,
						amount: convertedAmountString,
						paymentMethod,
						receiptDate: actualReceivedDate,
						notes: notes ?? null,
						createdBy: context.user.id,
						updatedBy: context.user.id,
					})
					.returning({ id: receipts.id });

				if (!createdReceipt) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Failed to create receipt",
					});
				}

				receiptId = createdReceipt.id;
				await updateInvoicePaymentStatus(
					tx,
					linkedInvoice.id,
					context.user.id,
				);
			}

			await tx
				.update(paymentSchedules)
				.set({
					paidAmount: newPaidAmountString,
					paidAt: new Date(),
					status: "completed",
					updatedAt: new Date(),
					updatedBy: context.user.id,
				})
				.where(eq(paymentSchedules.id, scheduleId));

			// Fetch booking for activity context
			const booking = await tx.query.bookings.findFirst({
				where: eq(bookings.id, schedule.bookingId),
				columns: { name: true },
			});

			// Update booking total received
			await tx
				.update(bookings)
				.set({
					totalReceived: sql`${bookings.totalReceived} + ${convertedAmountString}`,
					updatedAt: new Date(),
					updatedBy: context.user.id,
				})
				.where(eq(bookings.id, schedule.bookingId));

			// Track activity (non-blocking) - schedule marked as paid
			await safeTrackActivity(context, {
				entityType: "payment_schedule",
				entityId: scheduleId,
				entityName: `${schedule.name} (${formatAmount(schedule.amount)})`,
				action: "marked_paid",
				parentEntityType: "booking",
				parentEntityId: schedule.bookingId,
				parentEntityName: booking?.name ?? "Unknown Booking",
				metadata: {
					paidAmount: convertedAmountString,
					totalPaidAmount: newPaidAmountString,
					receivedId: created.id,
					receiptId,
				},
			});

			return {
				data: {
					receivedId: created.id,
					scheduleId,
					receiptId,
				},
				message: "Payment schedule converted successfully",
			};
		});
	});
