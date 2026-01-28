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
import { formatAmount, safeTrackActivity } from "../../activities/lib";
import { requirePermission } from "../../studio/lib/permissions";
import {
	createInvoiceInputSchema,
	createInvoiceOutputSchema,
} from "../../studio/schemas/invoice";
import { calculateGst, generateInvoiceNumber } from "../lib/invoice-helpers";

export const createInvoice = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/invoices",
		tags: ["Invoices"],
		summary: "Create invoice",
		description: "Create a new invoice manually with line items",
	})
	.input(createInvoiceInputSchema)
	.output(createInvoiceOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "payment", "create");

		const {
			bookingId,
			issueDate,
			dueDate,
			notes,
			terms,
			discountAmount,
			lineItems,
		} = input;

		const booking = await db.query.bookings.findFirst({
			where: and(
				eq(bookings.id, bookingId),
				eq(bookings.organizationId, context.organizationId),
				isNull(bookings.deletedAt),
			),
			columns: { id: true, name: true },
		});

		if (!booking) {
			throw new ORPCError("NOT_FOUND", {
				message: "Booking not found",
			});
		}

		const subtotal = lineItems.reduce((sum, item) => {
			const qty = Number.parseFloat(item.quantity ?? "1");
			const price = Number.parseFloat(item.unitPrice);
			return sum + qty * price;
		}, 0);

		const discount = discountAmount ? Number.parseFloat(discountAmount) : 0;
		const { taxAmount, totalAmount } = await calculateGst(
			subtotal,
			context.organizationId,
			discount,
		);

		return await db.transaction(async (tx) => {
			const invoiceNumber = await generateInvoiceNumber(
				bookingId,
				context.organizationId,
			);

			const [created] = await tx
				.insert(invoices)
				.values({
					organizationId: context.organizationId,
					bookingId,
					invoiceNumber,
					status: "draft",
					issueDate,
					dueDate: dueDate ?? null,
					subtotal: subtotal.toFixed(2),
					taxAmount: taxAmount.toFixed(2),
					discountAmount: discount.toFixed(2),
					totalAmount: totalAmount.toFixed(2),
					paidAmount: "0.00",
					notes: notes ?? null,
					terms: terms ?? null,
					createdBy: context.user.id,
					updatedBy: context.user.id,
				})
				.returning({ id: invoices.id });

			if (!created) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Failed to create invoice",
				});
			}

			const lineItemValues = lineItems.map((item, idx) => {
				const qty = Number.parseFloat(item.quantity ?? "1");
				const price = Number.parseFloat(item.unitPrice);
				const amount = qty * price;
				return {
					invoiceId: created.id,
					description: item.description,
					quantity: item.quantity ?? "1",
					unitPrice: item.unitPrice,
					amount: amount.toFixed(2),
					sortOrder: idx,
				};
			});

			await tx.insert(invoiceLineItems).values(lineItemValues);

			await safeTrackActivity(context, {
				entityType: "invoice",
				entityId: created.id,
				entityName: `${invoiceNumber} (${formatAmount(totalAmount.toFixed(2))})`,
				action: "created",
				parentEntityType: "booking",
				parentEntityId: bookingId,
				parentEntityName: booking.name,
				metadata: {
					invoiceNumber,
					totalAmount: totalAmount.toFixed(2),
				},
			});

			return {
				data: { id: created.id },
				message: "Invoice created successfully",
			};
		});
	});
