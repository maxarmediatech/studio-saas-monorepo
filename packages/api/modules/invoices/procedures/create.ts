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
import { centsToMoney, moneyToCents } from "../../studio/lib/money";
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

			const subtotalCents = lineItems.reduce((sum, item) => {
				const qty = Number.parseInt(item.quantity ?? "1", 10);
				const unitPriceCents = moneyToCents(item.unitPrice);
				return sum + qty * unitPriceCents;
			}, 0);

			const discountCents = discountAmount ? moneyToCents(discountAmount) : 0;
			if (discountCents > subtotalCents) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Discount cannot exceed subtotal",
				});
			}
			const discount = centsToMoney(discountCents);

			const { taxAmount, totalAmount } = await calculateGst(
				centsToMoney(subtotalCents),
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
						subtotal: centsToMoney(subtotalCents),
						taxAmount,
						discountAmount: discount,
						totalAmount,
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
					const qty = Number.parseInt(item.quantity ?? "1", 10);
					const unitPriceCents = moneyToCents(item.unitPrice);
					const amountCents = qty * unitPriceCents;
					return {
						invoiceId: created.id,
						description: item.description,
						quantity: item.quantity ?? "1",
						unitPrice: centsToMoney(unitPriceCents),
						amount: centsToMoney(amountCents),
						sortOrder: idx,
					};
				});

				await tx.insert(invoiceLineItems).values(lineItemValues);

				await safeTrackActivity(context, {
					entityType: "invoice",
					entityId: created.id,
					entityName: `${invoiceNumber} (${formatAmount(totalAmount)})`,
					action: "created",
					parentEntityType: "booking",
					parentEntityId: bookingId,
					parentEntityName: booking.name,
					metadata: {
						invoiceNumber,
						totalAmount,
					},
				});

				return {
				data: { id: created.id },
				message: "Invoice created successfully",
			};
		});
	});
