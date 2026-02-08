import { ORPCError } from "@orpc/server";
import { and, bookings, db, eq, invoices, isNull } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	detectChanges,
	formatAmount,
	formatDate,
	safeTrackFieldChanges,
} from "../../activities/lib";
import { requirePermission } from "../../studio/lib/permissions";
import { centsToMoney, moneyToCents } from "../../studio/lib/money";
import {
	updateInvoiceInputSchema,
	updateInvoiceOutputSchema,
} from "../../studio/schemas/invoice";
import { calculateGst, type InvoiceStatus } from "../lib/invoice-helpers";

export const updateInvoice = studioProtectedProcedure
	.route({
		method: "PUT",
		path: "/invoices/{id}",
		tags: ["Invoices"],
		summary: "Update invoice",
		description: "Update a draft invoice",
	})
	.input(updateInvoiceInputSchema)
	.output(updateInvoiceOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "payment", "update");

		const { id, ...updates } = input;

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
		if (status !== "draft") {
			throw new ORPCError("CONFLICT", {
				message:
					"Only draft invoices can be edited. Cancel this invoice and create a new one if changes are needed.",
			});
		}

		const updateData: Record<string, unknown> = {
			updatedAt: new Date(),
			updatedBy: context.user.id,
		};

		if (updates.issueDate !== undefined) {
			updateData.issueDate = updates.issueDate;
		}

		if (updates.dueDate !== undefined) {
			updateData.dueDate = updates.dueDate;
		}

		if (updates.notes !== undefined) {
			updateData.notes = updates.notes;
		}

		if (updates.terms !== undefined) {
			updateData.terms = updates.terms;
			}

			if (updates.discountAmount !== undefined) {
				const subtotalCents = moneyToCents(invoice.subtotal);
				const newDiscountCents = moneyToCents(updates.discountAmount);

				if (newDiscountCents > subtotalCents) {
					throw new ORPCError("BAD_REQUEST", {
						message: "Discount cannot exceed subtotal",
					});
				}

				const { taxAmount, totalAmount } = await calculateGst(
					centsToMoney(subtotalCents),
					context.organizationId,
					centsToMoney(newDiscountCents),
				);
				updateData.discountAmount = centsToMoney(newDiscountCents);
				updateData.taxAmount = taxAmount;
				updateData.totalAmount = totalAmount;
			}

		await db.update(invoices).set(updateData).where(eq(invoices.id, id));

		const booking = await db.query.bookings.findFirst({
			where: eq(bookings.id, invoice.bookingId),
			columns: { name: true },
		});

		const entityName = `${invoice.invoiceNumber} (${formatAmount(invoice.totalAmount)})`;

		const changes = detectChanges(
			{
				issueDate: invoice.issueDate,
				dueDate: invoice.dueDate,
				notes: invoice.notes,
				terms: invoice.terms,
				discountAmount: invoice.discountAmount,
			},
			{
				issueDate: updates.issueDate,
				dueDate: updates.dueDate,
				notes: updates.notes,
				terms: updates.terms,
				discountAmount: updates.discountAmount,
			},
			["issueDate", "dueDate", "notes", "terms", "discountAmount"],
		).map((c) => ({
			...c,
			oldValue:
				c.field === "discountAmount" && c.oldValue
					? formatAmount(c.oldValue)
					: (c.field === "issueDate" || c.field === "dueDate") &&
							c.oldValue
						? formatDate(c.oldValue)
						: c.oldValue,
			newValue:
				c.field === "discountAmount" && c.newValue
					? formatAmount(c.newValue)
					: (c.field === "issueDate" || c.field === "dueDate") &&
							c.newValue
						? formatDate(c.newValue)
						: c.newValue,
		}));

		if (changes.length > 0) {
			await safeTrackFieldChanges(context, {
				entityType: "invoice",
				entityId: id,
				entityName,
				parentEntityType: "booking",
				parentEntityId: invoice.bookingId,
				parentEntityName: booking?.name ?? "Unknown Booking",
				changes,
			});
		}

		return {
			data: { id },
			message: "Invoice updated successfully",
		};
	});
