import { ORPCError } from "@orpc/server";
import {
	bookings,
	count,
	db,
	eq,
	invoiceLineItems,
	invoices,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { safeTrackActivity } from "../../activities/lib";
import { requirePermission } from "../../studio/lib/permissions";
import {
	removeLineItemInputSchema,
	removeLineItemOutputSchema,
} from "../../studio/schemas/invoice";
import {
	type InvoiceStatus,
	recalculateInvoiceTotals,
} from "../lib/invoice-helpers";
import { getLockedInvoice } from "../lib/invoice-lock";

export const removeLineItem = studioProtectedProcedure
	.route({
		method: "DELETE",
		path: "/invoices/line-items/{id}",
		tags: ["Invoices"],
		summary: "Remove line item",
		description: "Remove a line item from a draft invoice",
	})
	.input(removeLineItemInputSchema)
	.output(removeLineItemOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "payment", "update");

		const { id } = input;

		const lineItem = await db.query.invoiceLineItems.findFirst({
			where: eq(invoiceLineItems.id, id),
		});

		if (!lineItem) {
			throw new ORPCError("NOT_FOUND", {
				message: "Line item not found",
			});
		}

		return await db.transaction(async (tx) => {
			const invoice = await getLockedInvoice(tx, {
				organizationId: context.organizationId,
				invoiceId: lineItem.invoiceId,
			});
			if (!invoice) {
				throw new ORPCError("NOT_FOUND", {
					message: "Invoice not found",
				});
			}
			if ((invoice.status as InvoiceStatus) !== "draft") {
				throw new ORPCError("CONFLICT", {
					message: "Can only remove line items from draft invoices",
				});
			}

			const currentLineItem = await tx.query.invoiceLineItems.findFirst({
				where: eq(invoiceLineItems.id, id),
			});
			if (!currentLineItem || currentLineItem.invoiceId !== invoice.id) {
				throw new ORPCError("NOT_FOUND", {
					message: "Line item not found",
				});
			}
			const [countResult] = await tx
				.select({ count: count().mapWith(Number) })
				.from(invoiceLineItems)
				.where(eq(invoiceLineItems.invoiceId, invoice.id));
			if ((countResult?.count ?? 0) <= 1) {
				throw new ORPCError("CONFLICT", {
					message:
						"Cannot remove the last line item. Delete the invoice instead.",
				});
			}

			await tx
				.delete(invoiceLineItems)
				.where(eq(invoiceLineItems.id, id));

			const totals = await recalculateInvoiceTotals(
				tx,
				lineItem.invoiceId,
			);
			await tx
				.update(invoices)
				.set({
					...totals,
					updatedAt: new Date(),
					updatedBy: context.user.id,
				})
				.where(eq(invoices.id, lineItem.invoiceId));

			const booking = await tx.query.bookings.findFirst({
				where: eq(bookings.id, invoice.bookingId),
				columns: { name: true },
			});

			await safeTrackActivity(context, {
				entityType: "invoice",
				entityId: lineItem.invoiceId,
				entityName: `${invoice.invoiceNumber} - Line item removed: ${currentLineItem.description}`,
				action: "updated",
				parentEntityType: "booking",
				parentEntityId: invoice.bookingId,
				parentEntityName: booking?.name ?? "Unknown Booking",
			});

			return {
				data: { id },
				message: "Line item removed successfully",
			};
		});
	});
