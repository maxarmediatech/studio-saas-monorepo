import { ORPCError } from "@orpc/server";
import { bookings, db, eq, invoiceLineItems, invoices } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	detectChanges,
	formatAmount,
	safeTrackFieldChanges,
} from "../../activities/lib";
import { centsToMoney, moneyToCents } from "../../studio/lib/money";
import { requirePermission } from "../../studio/lib/permissions";
import {
	updateLineItemInputSchema,
	updateLineItemOutputSchema,
} from "../../studio/schemas/invoice";
import {
	type InvoiceStatus,
	recalculateInvoiceTotals,
} from "../lib/invoice-helpers";
import { getLockedInvoice } from "../lib/invoice-lock";
import { isLumpSumType, parseItemizedQuantity } from "../lib/line-item-helpers";

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

		return db.transaction(async (tx) => {
			const discoveredLineItem =
				await tx.query.invoiceLineItems.findFirst({
					where: eq(invoiceLineItems.id, id),
					columns: { invoiceId: true },
				});

			if (!discoveredLineItem) {
				throw new ORPCError("NOT_FOUND", {
					message: "Line item not found",
				});
			}

			const invoice = await getLockedInvoice(tx, {
				organizationId: context.organizationId,
				invoiceId: discoveredLineItem.invoiceId,
			});

			if (!invoice) {
				throw new ORPCError("NOT_FOUND", {
					message: "Invoice not found",
				});
			}

			if ((invoice.status as InvoiceStatus) !== "draft") {
				throw new ORPCError("CONFLICT", {
					message: "Can only update line items on draft invoices",
				});
			}

			const lineItem = await tx.query.invoiceLineItems.findFirst({
				where: eq(invoiceLineItems.id, id),
			});
			if (!lineItem || lineItem.invoiceId !== invoice.id) {
				throw new ORPCError("NOT_FOUND", {
					message: "Line item not found",
				});
			}

			const updateData: Record<string, unknown> = {
				updatedAt: new Date(),
			};

			if (updates.description !== undefined) {
				updateData.description = updates.description;
			}

			if (updates.sortOrder !== undefined) {
				updateData.sortOrder = updates.sortOrder;
			}

			const effectiveType = updates.type ?? lineItem.type;
			const isLumpSum = isLumpSumType(effectiveType);
			const wasLumpSum = isLumpSumType(lineItem.type);
			const hasPricingUpdates =
				updates.type !== undefined ||
				updates.quantity !== undefined ||
				updates.unitPrice !== undefined ||
				updates.amount !== undefined;

			if (hasPricingUpdates) {
				if (isLumpSum) {
					if (
						updates.quantity !== undefined &&
						updates.quantity !== null
					) {
						throw new ORPCError("BAD_REQUEST", {
							message:
								"Quantity is not applicable for milestone/expense line items",
						});
					}
					if (
						updates.unitPrice !== undefined &&
						updates.unitPrice !== null
					) {
						throw new ORPCError("BAD_REQUEST", {
							message:
								"Unit price is not applicable for milestone/expense line items",
						});
					}
					if (!wasLumpSum && updates.amount === undefined) {
						throw new ORPCError("BAD_REQUEST", {
							message:
								"Amount is required when switching to milestone/expense line items",
						});
					}

					updateData.type = effectiveType;
					updateData.quantity = null;
					updateData.unitPrice = null;
					if (updates.amount !== undefined) {
						updateData.amount = updates.amount;
					}
				} else {
					if (updates.amount !== undefined) {
						throw new ORPCError("BAD_REQUEST", {
							message:
								"Amount is computed server-side for item/service line items",
						});
					}
					if (
						updates.quantity === null ||
						updates.unitPrice === null
					) {
						throw new ORPCError("BAD_REQUEST", {
							message:
								"Quantity and unit price cannot be null for item/service line items",
						});
					}
					if (
						wasLumpSum &&
						(updates.quantity === undefined ||
							updates.unitPrice === undefined)
					) {
						throw new ORPCError("BAD_REQUEST", {
							message:
								"Quantity and unit price are required when switching to item/service line items",
						});
					}

					const newQuantity = updates.quantity ?? lineItem.quantity;
					const newUnitPrice =
						updates.unitPrice ?? lineItem.unitPrice;
					if (!newQuantity || !newUnitPrice) {
						throw new ORPCError("BAD_REQUEST", {
							message:
								"Quantity and unit price are required for item/service line items",
						});
					}

					const qty = parseItemizedQuantity(newQuantity);
					const unitPriceCents = moneyToCents(newUnitPrice);
					updateData.type = effectiveType;
					updateData.quantity = newQuantity;
					updateData.unitPrice = centsToMoney(unitPriceCents);
					updateData.amount = centsToMoney(qty * unitPriceCents);
				}
			}

			const [updatedLineItem] = await tx
				.update(invoiceLineItems)
				.set(updateData)
				.where(eq(invoiceLineItems.id, id))
				.returning({
					description: invoiceLineItems.description,
					type: invoiceLineItems.type,
					quantity: invoiceLineItems.quantity,
					unitPrice: invoiceLineItems.unitPrice,
					amount: invoiceLineItems.amount,
				});

			if (!updatedLineItem) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Failed to update line item",
				});
			}

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

			const changes = detectChanges(
				{
					description: lineItem.description,
					type: lineItem.type,
					quantity: lineItem.quantity,
					unitPrice: lineItem.unitPrice,
					amount: lineItem.amount,
				},
				{
					description: updatedLineItem.description,
					type: updatedLineItem.type,
					quantity: updatedLineItem.quantity,
					unitPrice: updatedLineItem.unitPrice,
					amount: updatedLineItem.amount,
				},
				["description", "type", "quantity", "unitPrice", "amount"],
			).map((c) => ({
				...c,
				oldValue:
					(c.field === "unitPrice" || c.field === "amount") &&
					c.oldValue
						? formatAmount(c.oldValue)
						: c.oldValue,
				newValue:
					(c.field === "unitPrice" || c.field === "amount") &&
					c.newValue
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
