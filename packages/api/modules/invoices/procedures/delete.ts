import { ORPCError } from "@orpc/server";
import { and, bookings, db, eq, invoices, isNull } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { formatAmount, safeTrackActivity } from "../../activities/lib";
import { requirePermission } from "../../studio/lib/permissions";
import {
	deleteInvoiceInputSchema,
	deleteInvoiceOutputSchema,
} from "../../studio/schemas/invoice";
import type { InvoiceStatus } from "../lib/invoice-helpers";

export const deleteInvoice = studioProtectedProcedure
	.route({
		method: "DELETE",
		path: "/invoices/{id}",
		tags: ["Invoices"],
		summary: "Delete invoice",
		description: "Soft delete an invoice",
	})
	.input(deleteInvoiceInputSchema)
	.output(deleteInvoiceOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "payment", "delete");

		const { id } = input;

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

		const status = invoice.status as InvoiceStatus;
		if (status === "paid" || status === "partial") {
			throw new ORPCError("CONFLICT", {
				message:
					"Cannot delete invoices with payments. Cancel the invoice instead.",
			});
		}

		const booking = await db.query.bookings.findFirst({
			where: and(
				eq(bookings.id, invoice.bookingId),
				eq(bookings.organizationId, context.organizationId),
			),
			columns: { name: true },
		});

		await db
			.update(invoices)
			.set({
				deletedAt: new Date(),
				deletedBy: context.user.id,
				updatedAt: new Date(),
				updatedBy: context.user.id,
			})
			.where(eq(invoices.id, id));

		await safeTrackActivity(context, {
			entityType: "invoice",
			entityId: id,
			entityName: `${invoice.invoiceNumber} (${formatAmount(invoice.totalAmount)})`,
			action: "deleted",
			parentEntityType: "booking",
			parentEntityId: invoice.bookingId,
			parentEntityName: booking?.name ?? "Unknown Booking",
		});

		return {
			data: { id },
			message: "Invoice deleted successfully",
		};
	});
