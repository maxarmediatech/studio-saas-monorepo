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
import { centsToMoney, moneyToCents } from "../../../studio/lib/money";
import { requirePermission } from "../../../studio/lib/permissions";
import {
	convertScheduleInputSchema,
	convertScheduleOutputSchema,
} from "../../../studio/schemas/payment";

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
				const existingReceived = await tx.query.receivedAmounts.findFirst({
					where: and(
						eq(receivedAmounts.paymentScheduleId, scheduleId),
						isNull(receivedAmounts.deletedAt),
					),
					columns: { id: true },
				});

				const existingReceipt = existingReceived
					? await tx.query.receipts.findFirst({
						where: and(
							eq(receipts.receivedAmountId, existingReceived.id),
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

			if (schedule.status === "cancelled") {
				throw new ORPCError("CONFLICT", {
					message: "Cancelled schedule cannot be converted",
				});
			}

			const convertedAmountCents = moneyToCents(amount);
			const scheduleAmountCents = moneyToCents(schedule.amount);
			const existingPaidAmountCents = moneyToCents(schedule.paidAmount);
			const remainingAmountCents = scheduleAmountCents - existingPaidAmountCents;
			const newPaidAmountCents =
				existingPaidAmountCents + convertedAmountCents;

			if (!Number.isFinite(convertedAmountCents) || convertedAmountCents <= 0) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Amount must be greater than zero",
				});
			}

			if (remainingAmountCents <= 0) {
				throw new ORPCError("CONFLICT", {
					message: "Schedule is already fully paid",
				});
			}

			if (convertedAmountCents > remainingAmountCents) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Amount cannot exceed remaining scheduled balance",
				});
			}

			if (convertedAmountCents !== remainingAmountCents) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Amount must match remaining scheduled balance",
				});
			}

			const convertedAmountString = centsToMoney(convertedAmountCents);
			const newPaidAmountString = centsToMoney(newPaidAmountCents);

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

				let createdReceiptId: string | null = null;
				for (
					let attempt = 0;
					attempt < MAX_RECEIPT_INSERT_ATTEMPTS;
					attempt++
				) {
					try {
						const attemptReceiptId = await tx.transaction(
							async (receiptTx) => {
								const receiptNumber = await generateReceiptNumber(
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
