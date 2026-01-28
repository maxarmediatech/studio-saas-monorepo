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

		if (currentStatus === "cancelled") {
			return {
				data: { id },
				message: "Invoice is already cancelled",
			};
		}

		const updateData: Record<string, unknown> = {
			status: "cancelled",
			updatedAt: new Date(),
			updatedBy: context.user.id,
		};

		if (reason) {
			const existingNotes = invoice.notes ?? "";
			const cancellationNote = `[Cancelled: ${reason}]`;
			updateData.notes = existingNotes
				? `${existingNotes}\n\n${cancellationNote}`
				: cancellationNote;
		}

		await db.update(invoices).set(updateData).where(eq(invoices.id, id));

		const booking = await db.query.bookings.findFirst({
			where: eq(bookings.id, invoice.bookingId),
			columns: { name: true },
		});

		await safeTrackStatusChange(context, {
			entityType: "invoice",
			entityId: id,
			entityName: `${invoice.invoiceNumber} (${formatAmount(invoice.totalAmount)})`,
			oldStatus: currentStatus,
			newStatus: "cancelled",
			parentEntityType: "booking",
			parentEntityId: invoice.bookingId,
			parentEntityName: booking?.name ?? "Unknown Booking",
			metadata: reason ? { reason } : undefined,
		});

		return {
			data: { id },
			message: "Invoice cancelled successfully",
		};
	});
