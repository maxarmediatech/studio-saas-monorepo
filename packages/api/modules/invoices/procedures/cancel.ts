import { ORPCError } from "@orpc/server";
import { and, bookings, db, eq, invoices, isNull } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { formatAmount, safeTrackStatusChange } from "../../activities/lib";
import { requirePermission } from "../../studio/lib/permissions";
import {
	cancelInvoiceInputSchema,
	cancelInvoiceOutputSchema,
} from "../../studio/schemas/invoice";
import {
	getInvalidTransitionMessage,
	type InvoiceStatus,
	isValidStatusTransition,
} from "../lib/invoice-helpers";
import { cancelUnpaidInvoice } from "../lib/unpaid-invoice-transitions";

export const cancelInvoice = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/invoices/{id}/cancel",
		tags: ["Invoices"],
		summary: "Cancel invoice",
		description: "Change invoice status to cancelled",
	})
	.input(cancelInvoiceInputSchema)
	.output(cancelInvoiceOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "payment", "update");

		const { id, reason } = input;

		const invoice = await db.query.invoices.findFirst({
			where: and(
				eq(invoices.id, id),
				eq(invoices.organizationId, context.organizationId),
				isNull(invoices.deletedAt),
			),
		});

		if (!invoice) {
			throw new ORPCError("NOT_FOUND", {
				message: "Invoice not found",
			});
		}

		const currentStatus = invoice.status as InvoiceStatus;
		if (!isValidStatusTransition(currentStatus, "cancelled")) {
			throw new ORPCError("CONFLICT", {
				message: getInvalidTransitionMessage(
					currentStatus,
					"cancelled",
				),
			});
		}

		const paidAmount = Number.parseFloat(invoice.paidAmount);
		if (paidAmount > 0) {
			throw new ORPCError("CONFLICT", {
				message:
					"Cannot cancel an invoice with recorded payments. Void the receipts first.",
			});
		}

		if (currentStatus === "cancelled") {
			return {
				data: { id },
				message: "Invoice is already cancelled",
			};
		}

		let updatedNotes: string | undefined;
		if (reason) {
			const existingNotes = invoice.notes ?? "";
			const cancellationNote = `[Cancelled: ${reason}]`;
			updatedNotes = existingNotes
				? `${existingNotes}\n\n${cancellationNote}`
				: cancellationNote;
		}

		const cancelled = await cancelUnpaidInvoice(db, {
			organizationId: context.organizationId,
			invoiceId: id,
			actorId: context.user.id,
			expectedStatus: currentStatus,
			notes: updatedNotes,
		});

		if (!cancelled) {
			const current = await db.query.invoices.findFirst({
				where: and(
					eq(invoices.id, id),
					eq(invoices.organizationId, context.organizationId),
					isNull(invoices.deletedAt),
				),
			});

			if (!current) {
				throw new ORPCError("NOT_FOUND", {
					message: "Invoice not found",
				});
			}

			if (current.status === "cancelled") {
				return {
					data: { id },
					message: "Invoice is already cancelled",
				};
			}

			if (Number.parseFloat(current.paidAmount) > 0) {
				throw new ORPCError("CONFLICT", {
					message:
						"Cannot cancel an invoice with recorded payments. Void the receipts first.",
				});
			}

			throw new ORPCError("CONFLICT", {
				message: getInvalidTransitionMessage(
					current.status as InvoiceStatus,
					"cancelled",
				),
			});
		}

		const booking = await db.query.bookings.findFirst({
			where: eq(bookings.id, invoice.bookingId),
			columns: { name: true },
		});

		await safeTrackStatusChange(context, {
			entityType: "invoice",
			entityId: id,
			entityName: `${cancelled.invoiceNumber} (${formatAmount(cancelled.totalAmount)})`,
			oldStatus: currentStatus,
			newStatus: "cancelled",
			parentEntityType: "booking",
			parentEntityId: cancelled.bookingId,
			parentEntityName: booking?.name ?? "Unknown Booking",
			metadata: reason ? { reason } : undefined,
		});

		return {
			data: { id },
			message: "Invoice cancelled successfully",
		};
	});
