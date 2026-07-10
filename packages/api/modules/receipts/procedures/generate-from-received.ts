import { ORPCError } from "@orpc/server";
import {
	and,
	db,
	desc,
	eq,
	isNull,
	receipts,
	receivedAmounts,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { formatAmount, safeTrackActivity } from "../../activities/lib";
import { requirePermission } from "../../studio/lib/permissions";
import {
	generateReceiptFromReceivedInputSchema,
	generateReceiptFromReceivedOutputSchema,
} from "../../studio/schemas/receipt";
import { getLockedReceivedPayment } from "../../studio-payments/lib/received-payment-lock";
import {
	getLockedBookingForReceipt,
	getLockedInvoiceForReceipt,
} from "../lib/locked-invoice-for-receipt";
import {
	generateReceiptNumber,
	updateInvoicePaymentStatus,
} from "../lib/receipt-helpers";

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

export const generateReceiptFromReceived = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/receipts/from-received",
		tags: ["Receipts"],
		summary: "Generate receipt from received payment",
		description:
			"Generate a receipt from an existing received payment with or without an invoice",
	})
	.input(generateReceiptFromReceivedInputSchema)
	.output(generateReceiptFromReceivedOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "payment", "create");

		const { receivedAmountId } = input;

		return await db.transaction(async (tx) => {
			const lockPlan = await tx.query.receivedAmounts.findFirst({
				where: and(
					eq(receivedAmounts.id, receivedAmountId),
					eq(receivedAmounts.organizationId, context.organizationId),
					isNull(receivedAmounts.deletedAt),
				),
				columns: { bookingId: true, invoiceId: true },
			});

			if (!lockPlan) {
				throw new ORPCError("NOT_FOUND", {
					message: "Received payment not found",
				});
			}

			const booking = await getLockedBookingForReceipt(tx, {
				organizationId: context.organizationId,
				bookingId: lockPlan.bookingId,
			});

			if (!booking) {
				throw new ORPCError("NOT_FOUND", {
					message: "Booking not found",
				});
			}

			if (lockPlan.invoiceId) {
				const invoice = await getLockedInvoiceForReceipt(tx, {
					organizationId: context.organizationId,
					bookingId: lockPlan.bookingId,
					invoiceId: lockPlan.invoiceId,
				});

				if (!invoice) {
					throw new ORPCError("NOT_FOUND", {
						message:
							"Invoice not found or does not belong to this booking",
					});
				}
			}

			const received = await getLockedReceivedPayment(tx, {
				organizationId: context.organizationId,
				receivedAmountId,
			});

			if (!received) {
				throw new ORPCError("NOT_FOUND", {
					message: "Received payment not found",
				});
			}

			if (
				received.bookingId !== lockPlan.bookingId ||
				received.invoiceId !== lockPlan.invoiceId
			) {
				throw new ORPCError("CONFLICT", {
					message:
						"Received payment relationships changed during receipt generation. Retry the request.",
				});
			}

			const existingReceipt = await tx.query.receipts.findFirst({
				where: and(
					eq(receipts.organizationId, context.organizationId),
					eq(receipts.receivedAmountId, received.id),
					isNull(receipts.deletedAt),
				),
				columns: {
					id: true,
				},
				orderBy: desc(receipts.createdAt),
			});

			if (existingReceipt) {
				return {
					data: { id: existingReceipt.id },
					message: "Receipt already exists",
				};
			}

			let createdReceipt: { id: string; receiptNumber: string } | null =
				null;

			for (
				let attempt = 0;
				attempt < MAX_RECEIPT_INSERT_ATTEMPTS;
				attempt++
			) {
				try {
					const attemptReceipt = await tx.transaction(
						async (receiptTx) => {
							const receiptNumber = await generateReceiptNumber(
								received.bookingId,
								context.organizationId,
								receiptTx,
							);

							const [created] = await receiptTx
								.insert(receipts)
								.values({
									organizationId: context.organizationId,
									bookingId: received.bookingId,
									invoiceId: received.invoiceId ?? null,
									receivedAmountId: received.id,
									receiptNumber,
									amount: received.amount,
									paymentMethod: received.paymentMethod,
									receiptDate: received.receivedDate,
									notes: received.notes,
									createdBy: context.user.id,
									updatedBy: context.user.id,
								})
								.returning({
									id: receipts.id,
									receiptNumber: receipts.receiptNumber,
								});

							if (!created) {
								throw new ORPCError("INTERNAL_SERVER_ERROR", {
									message: "Failed to create receipt",
								});
							}

							return created;
						},
					);

					createdReceipt = attemptReceipt;
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

			if (!createdReceipt) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Failed to create receipt",
				});
			}

			if (received.invoiceId) {
				await updateInvoicePaymentStatus(
					tx,
					received.invoiceId,
					context.user.id,
				);
			}

			await safeTrackActivity(context, {
				entityType: "receipt",
				entityId: createdReceipt.id,
				entityName: `Receipt ${createdReceipt.receiptNumber} (${formatAmount(received.amount)})`,
				action: "created",
				parentEntityType: "booking",
				parentEntityId: received.bookingId,
				parentEntityName: booking.name,
				metadata: {
					receiptNumber: createdReceipt.receiptNumber,
					amount: received.amount,
					type: "receipt",
					source: "manual_from_payment",
					receivedAmountId: received.id,
					invoiceId: received.invoiceId,
				},
			});

			return {
				data: { id: createdReceipt.id },
				message: "Receipt generated successfully",
			};
		});
	});
