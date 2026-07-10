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
	getLockedBookingForReceipt,
	getLockedScheduleForReceipt,
	getLockedScheduleInvoiceForReceipt,
} from "../../../receipts/lib/locked-invoice-for-receipt";
import {
	generateReceiptNumber,
	updateInvoicePaymentStatus,
} from "../../../receipts/lib/receipt-helpers";
import { requirePermission } from "../../../studio/lib/permissions";
import {
	convertScheduleInputSchema,
	convertScheduleOutputSchema,
} from "../../../studio/schemas/payment";
import { buildSchedulePaymentTransition } from "../../lib/schedule-payment-transition";

const MAX_RECEIPT_INSERT_ATTEMPTS = 5;

function isReceiptNumberConflict(error: unknown): boolean {
	const code = (error as { code?: string })?.code;
	const constraint = (error as { constraint?: string })?.constraint;

	if (code === "23505") {
		return true;
	}

	if (constraint === "receipts_org_number_idx") {
		return true;
	}

	return (
		error instanceof Error &&
		error.message.toLowerCase().includes("receipts_org_number_idx")
	);
}

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

		// A lookup only discovers the booking ID. The schedule is re-read after
		// booking and invoice locks, per the financial transition lock order.
		return await db.transaction(async (tx) => {
			const lockPlan = await tx.query.paymentSchedules.findFirst({
				where: and(
					eq(paymentSchedules.id, scheduleId),
					eq(paymentSchedules.organizationId, context.organizationId),
					isNull(paymentSchedules.deletedAt),
				),
			});

			if (!lockPlan) {
				throw new ORPCError("NOT_FOUND", {
					message: "Payment schedule not found",
				});
			}

			const lockedBooking = await getLockedBookingForReceipt(tx, {
				organizationId: context.organizationId,
				bookingId: lockPlan.bookingId,
			});

			if (!lockedBooking) {
				throw new ORPCError("NOT_FOUND", {
					message: "Booking not found",
				});
			}

			const linkedInvoice = await getLockedScheduleInvoiceForReceipt(tx, {
				organizationId: context.organizationId,
				bookingId: lockPlan.bookingId,
				paymentScheduleId: scheduleId,
			});

			const schedule = await getLockedScheduleForReceipt(tx, {
				organizationId: context.organizationId,
				bookingId: lockPlan.bookingId,
				paymentScheduleId: scheduleId,
			});

			if (!schedule) {
				throw new ORPCError("NOT_FOUND", {
					message: "Payment schedule not found",
				});
			}

			if (
				schedule.status === "partial" ||
				schedule.status === "completed"
			) {
				const existingReceived =
					await tx.query.receivedAmounts.findFirst({
						where: and(
							eq(receivedAmounts.paymentScheduleId, scheduleId),
							eq(
								receivedAmounts.organizationId,
								context.organizationId,
							),
							isNull(receivedAmounts.deletedAt),
						),
						columns: { id: true },
					});

				const existingReceipt = existingReceived
					? await tx.query.receipts.findFirst({
							where: and(
								eq(
									receipts.receivedAmountId,
									existingReceived.id,
								),
								eq(
									receipts.organizationId,
									context.organizationId,
								),
								isNull(receipts.deletedAt),
							),
							columns: { id: true },
						})
					: null;

				return {
					data: {
						receivedId: existingReceived?.id ?? scheduleId,
						scheduleId,
						receiptId: existingReceipt?.id ?? null,
					},
					message: "Schedule already converted to payment",
				};
			}

			const schedulePayment = buildSchedulePaymentTransition(
				schedule,
				amount,
				"Cancelled schedule cannot be converted",
			);

			// Use current date if not provided
			const actualReceivedDate =
				receivedDate ?? new Date().toISOString().split("T")[0];

			const [created] = await tx
				.insert(receivedAmounts)
				.values({
					organizationId: context.organizationId,
					bookingId: schedule.bookingId,
					amount: schedulePayment.amount,
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

				let createdReceiptId: string | null = null;
				for (
					let attempt = 0;
					attempt < MAX_RECEIPT_INSERT_ATTEMPTS;
					attempt++
				) {
					try {
						const attemptReceiptId = await tx.transaction(
							async (receiptTx) => {
								const receiptNumber =
									await generateReceiptNumber(
										schedule.bookingId,
										context.organizationId,
										receiptTx,
									);

								const [createdReceipt] = await receiptTx
									.insert(receipts)
									.values({
										organizationId: context.organizationId,
										bookingId: schedule.bookingId,
										invoiceId: linkedInvoice.id,
										receivedAmountId: created.id,
										receiptNumber,
						amount: schedulePayment.amount,
										paymentMethod,
										receiptDate: actualReceivedDate,
										notes: notes ?? null,
										createdBy: context.user.id,
										updatedBy: context.user.id,
									})
									.returning({ id: receipts.id });

								if (!createdReceipt) {
									throw new ORPCError(
										"INTERNAL_SERVER_ERROR",
										{
											message: "Failed to create receipt",
										},
									);
								}

								return createdReceipt.id;
							},
						);

						createdReceiptId = attemptReceiptId;
						break;
					} catch (error) {
						if (
							isReceiptNumberConflict(error) &&
							attempt < MAX_RECEIPT_INSERT_ATTEMPTS - 1
						) {
							continue;
						}
						throw error;
					}
				}

				if (!createdReceiptId) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Failed to create receipt",
					});
				}

				receiptId = createdReceiptId;
				await updateInvoicePaymentStatus(
					tx,
					linkedInvoice.id,
					context.user.id,
				);
			}

			await tx
				.update(paymentSchedules)
				.set({
					paidAmount: schedulePayment.paidAmount,
					paidAt: schedulePayment.paidAt,
					status: schedulePayment.status,
					updatedAt: new Date(),
					updatedBy: context.user.id,
				})
				.where(eq(paymentSchedules.id, scheduleId));

			// Update booking total received
			await tx
				.update(bookings)
				.set({
					totalReceived: sql`${bookings.totalReceived} + ${schedulePayment.amount}`,
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
				parentEntityName: lockedBooking.name,
				metadata: {
					paidAmount: schedulePayment.amount,
					totalPaidAmount: schedulePayment.paidAmount,
					scheduleStatus: schedulePayment.status,
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
