import { ORPCError } from "@orpc/server";
import {
	and,
	bookings,
	db,
	eq,
	invoiceLineItems,
	invoices,
	isNull,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	detectChanges,
	formatAmount,
	safeTrackFieldChanges,
} from "../../activities/lib";
import { requirePermission } from "../../studio/lib/permissions";
import { centsToMoney, moneyToCents } from "../../studio/lib/money";
import {
	updateLineItemInputSchema,
	updateLineItemOutputSchema,
} from "../../studio/schemas/invoice";
import {
	type InvoiceStatus,
	recalculateInvoiceTotals,
} from "../lib/invoice-helpers";

export const updateLineItem = studioProtectedProcedure
	.route({
		method: "PUT",
		path: "/invoices/line-items/{id}",
		tags: ["Invoices"],
		summary: "Update line item",
		description: "Update a line item on a draft invoice",
	})
	.input(updateLineItemInputSchema)
	.output(updateLineItemOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "payment", "update");

		const { id, ...updates } = input;

		const lineItem = await db.query.invoiceLineItems.findFirst({
			where: eq(invoiceLineItems.id, id),
		});

		if (!lineItem) {
			throw new ORPCError("NOT_FOUND", {
				message: "Line item not found",
			});
		}

		const invoice = await db.query.invoices.findFirst({
			where: and(
				eq(invoices.id, lineItem.invoiceId),
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
		if (status !== "draft") {
			throw new ORPCError("CONFLICT", {
				message: "Can only update line items on draft invoices",
			});
		}

		const updateData: Record<string, unknown> = {
			updatedAt: new Date(),
		};

		const newQuantity = updates.quantity ?? lineItem.quantity;
		const newUnitPrice = updates.unitPrice ?? lineItem.unitPrice;

		if (updates.description !== undefined) {
			updateData.description = updates.description;
		}

		if (updates.quantity !== undefined) {
			updateData.quantity = updates.quantity;
		}

			if (updates.unitPrice !== undefined) {
				updateData.unitPrice = centsToMoney(moneyToCents(updates.unitPrice));
			}

		if (updates.sortOrder !== undefined) {
			updateData.sortOrder = updates.sortOrder;
		}

			if (updates.quantity !== undefined || updates.unitPrice !== undefined) {
				const qty = Number.parseInt(newQuantity, 10);
				const unitPriceCents = moneyToCents(newUnitPrice);
				updateData.amount = centsToMoney(qty * unitPriceCents);
			}

			return await db.transaction(async (tx) => {
				await tx
					.update(invoiceLineItems)
					.set(updateData)
					.where(eq(invoiceLineItems.id, id));

				const totals = await recalculateInvoiceTotals(tx, lineItem.invoiceId);
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

			const changes = detectChanges(
				{
					description: lineItem.description,
					quantity: lineItem.quantity,
					unitPrice: lineItem.unitPrice,
				},
				{
					description: updates.description,
					quantity: updates.quantity,
					unitPrice: updates.unitPrice,
				},
				["description", "quantity", "unitPrice"],
			).map((c) => ({
				...c,
				oldValue:
					c.field === "unitPrice" && c.oldValue
						? formatAmount(c.oldValue)
						: c.oldValue,
				newValue:
					c.field === "unitPrice" && c.newValue
						? formatAmount(c.newValue)
						: c.newValue,
			}));

			if (changes.length > 0) {
				await safeTrackFieldChanges(context, {
					entityType: "invoice",
					entityId: lineItem.invoiceId,
					entityName: invoice.invoiceNumber,
					parentEntityType: "booking",
					parentEntityId: invoice.bookingId,
					parentEntityName: booking?.name ?? "Unknown Booking",
					changes,
				});
			}

			return {
				data: { id },
				message: "Line item updated successfully",
			};
		});
	});
