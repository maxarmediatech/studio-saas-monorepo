import { ORPCError } from "@orpc/server";
import {
	bookings,
	db,
	eq,
	invoiceLineItems,
	invoices,
	sql,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { safeTrackActivity } from "../../activities/lib";
import { requirePermission } from "../../studio/lib/permissions";
import {
	addLineItemInputSchema,
	addLineItemOutputSchema,
} from "../../studio/schemas/invoice";
import {
	type InvoiceStatus,
	recalculateInvoiceTotals,
} from "../lib/invoice-helpers";
import { getLockedInvoice } from "../lib/invoice-lock";
import { computeLineItemFields } from "../lib/line-item-helpers";

export const addLineItem = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/invoices/{invoiceId}/line-items",
		tags: ["Invoices"],
		summary: "Add line item to invoice",
		description: "Add a new line item to a draft invoice",
	})
	.input(addLineItemInputSchema)
	.output(addLineItemOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "payment", "update");

		const {
			invoiceId,
			description,
			quantity,
			unitPrice,
			amount,
			type,
			sortOrder,
		} = input;

		const effectiveType = type ?? "item";
		const fields = computeLineItemFields(
			{ type: effectiveType, quantity, unitPrice, amount },
			effectiveType,
		);

		return await db.transaction(async (tx) => {
			const invoice = await getLockedInvoice(tx, {
				organizationId: context.organizationId,
				invoiceId,
			});
			if (!invoice) {
				throw new ORPCError("NOT_FOUND", {
					message: "Invoice not found",
				});
			}
			if ((invoice.status as InvoiceStatus) !== "draft") {
				throw new ORPCError("CONFLICT", {
					message: "Can only add line items to draft invoices",
				});
			}

			let finalSortOrder = sortOrder;
			if (finalSortOrder === undefined) {
				const [maxSort] = await tx
					.select({
						maxOrder: sql<number>`COALESCE(MAX(${invoiceLineItems.sortOrder}), -1)`,
					})
					.from(invoiceLineItems)
					.where(eq(invoiceLineItems.invoiceId, invoiceId));
				finalSortOrder = (maxSort?.maxOrder ?? -1) + 1;
			}

			const [created] = await tx
				.insert(invoiceLineItems)
				.values({
					invoiceId,
					description,
					...fields,
					sortOrder: finalSortOrder,
				})
				.returning({ id: invoiceLineItems.id });

			if (!created) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Failed to add line item",
				});
			}

			const totals = await recalculateInvoiceTotals(tx, invoiceId);
			await tx
				.update(invoices)
				.set({
					...totals,
					updatedAt: new Date(),
					updatedBy: context.user.id,
				})
				.where(eq(invoices.id, invoiceId));

			const booking = await tx.query.bookings.findFirst({
				where: eq(bookings.id, invoice.bookingId),
				columns: { name: true },
			});

			await safeTrackActivity(context, {
				entityType: "invoice",
				entityId: invoiceId,
				entityName: `${invoice.invoiceNumber} - Line item added: ${description}`,
				action: "updated",
				parentEntityType: "booking",
				parentEntityId: invoice.bookingId,
				parentEntityName: booking?.name ?? "Unknown Booking",
			});

			return {
				data: { id: created.id },
				message: "Line item added successfully",
			};
		});
	});
