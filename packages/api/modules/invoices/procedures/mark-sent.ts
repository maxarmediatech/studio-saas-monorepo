import { ORPCError } from "@orpc/server";
import { bookings, db, eq, invoices } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { formatAmount, safeTrackStatusChange } from "../../activities/lib";
import { requirePermission } from "../../studio/lib/permissions";
import {
	markInvoiceSentInputSchema,
	markInvoiceSentOutputSchema,
} from "../../studio/schemas/invoice";
import {
	getInvalidTransitionMessage,
	type InvoiceStatus,
	isValidStatusTransition,
} from "../lib/invoice-helpers";
import { getLockedInvoice } from "../lib/invoice-lock";

export const markInvoiceSent = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/invoices/{id}/send",
		tags: ["Invoices"],
		summary: "Mark invoice as sent",
		description: "Change invoice status to sent and record sent timestamp",
	})
	.input(markInvoiceSentInputSchema)
	.output(markInvoiceSentOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "payment", "update");

		const { id, sentAt } = input;

		const transition = await db.transaction(async (tx) => {
			const invoice = await getLockedInvoice(tx, {
				organizationId: context.organizationId,
				invoiceId: id,
			});
			if (!invoice) {
				throw new ORPCError("NOT_FOUND", {
					message: "Invoice not found",
				});
			}

			const currentStatus = invoice.status as InvoiceStatus;
			if (!isValidStatusTransition(currentStatus, "sent")) {
				throw new ORPCError("CONFLICT", {
					message: getInvalidTransitionMessage(currentStatus, "sent"),
				});
			}
			if (currentStatus === "sent") {
				return { invoice, alreadySent: true, currentStatus };
			}

			const sentTimestamp = sentAt ? new Date(sentAt) : new Date();
			await tx
				.update(invoices)
				.set({
					status: "sent",
					sentAt: sentTimestamp,
					updatedAt: new Date(),
					updatedBy: context.user.id,
				})
				.where(eq(invoices.id, id));
			return { invoice, alreadySent: false, currentStatus };
		});

		if (transition.alreadySent) {
			return {
				data: { id },
				message: "Invoice is already marked as sent",
			};
		}

		const booking = await db.query.bookings.findFirst({
			where: eq(bookings.id, transition.invoice.bookingId),
			columns: { name: true },
		});

		await safeTrackStatusChange(context, {
			entityType: "invoice",
			entityId: id,
			entityName: `${transition.invoice.invoiceNumber} (${formatAmount(transition.invoice.totalAmount)})`,
			oldStatus: transition.currentStatus,
			newStatus: "sent",
			parentEntityType: "booking",
			parentEntityId: transition.invoice.bookingId,
			parentEntityName: booking?.name ?? "Unknown Booking",
		});

		return {
			data: { id },
			message: "Invoice marked as sent",
		};
	});
